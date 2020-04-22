import * as TYPES from './constants'
import * as engine from './engine'
import { Action, State, Hand, Rule, Player, Card, HistoryItem } from '../types'
import { defaultState, getDefaultSideBets, getDefaultRules } from './presets'
import * as actions from './actions'

const appendEpoch = (action: Action): HistoryItem => {
  const epoch = {
    ts: new Date().getTime()
  }
  return {...epoch, action}
}

export default class Game {
  private state: State;

  constructor (initialState: State, rules: Rule = getDefaultRules()) {
    this.state = initialState ? {...initialState} : defaultState(rules)
    this.dispatch = this.dispatch.bind(this)
    this.getState = this.getState.bind(this)
    this.setState = this.setState.bind(this)
    this.enforceRules = this.enforceRules.bind(this)
    this._dispatch = this._dispatch.bind(this)
    this._drawCard = this._drawCard.bind(this)
  }

  enforceRules (handInfo: Hand): Hand {
    const { availableActions, playerValue } = handInfo
    const { rules, history } = this.state
    if (!engine.canDouble(rules.double, playerValue)) {
      availableActions.double = false
    }
    if (!rules.split) {
      availableActions.split = false
    }
    if (!rules.surrender) {
      availableActions.surrender = false
    }
    if (!rules.doubleAfterSplit) {
      if (history.some(x => x.action.type === TYPES.SPLIT)) {
        availableActions.double = false
      }
    }
    if (!rules.insurance) {
      availableActions.insurance = false
    }
    return handInfo
  }

  getState () : State {
    return {
      ...this.state
    }
  }

  setState (state: State): void {
    this.state = {
      ...this.state,
      ...state
    }
  }

  dispatch (action: Action): State {
    //handInfo -> playerHands
    try {
      const isActionAllowed = engine.checkActionAllowed(action, this.getState())
      if(isActionAllowed) {
        return this._dispatch(action)
      } else {
        return this._dispatch(actions.invalid(action, `${action.type} is not allowed when stage is ${this.state.stage}`))
      }
    } catch(e) {
      return this._dispatch(actions.invalid(action, e.message))
    }
  }

  public getActivePlayer(): { activePlayerId: number, activeHandId: number } {
    const { activePlayerId, activeHandId } = this.state.stage
    if(activePlayerId === undefined || activeHandId === undefined) {
      throw Error('"playerId" or "handId" are omitted from the stage when getting Active Player')
    }
    return { activePlayerId, activeHandId }
  }

  _dispatch (action: Action): State {
    switch (action.type) {

      case 'BET': {
        // The players can take bets simultaneously, but only once
        if(action.payload === undefined) {
          throw Error('Payload is omitted')
        }
        const { bet, playerId, sideBets } = action.payload
        if(bet === undefined || playerId === undefined) {
          throw Error('"bet" or "playerId" are omitted from the payload')
        }
        let players = this.state.players
        const player: Player = players[playerId]
        player.initialBet = bet
        players[playerId] = player
        //handle sideBets
        if(sideBets) {
          player.sideBetsFromUser = sideBets
        }
        //calculate the next stage
        let stage: State['stage'] = { name: 'STAGE_READY' }
        if(players.every(x => x.initialBet > 0 || x.initialBet === Infinity)) { //infinity if player left from the course
          //next stage
          stage = { name: 'STAGE_DEAL_CARDS' }
        }
        //set state
        this.state.history.push(appendEpoch(action))
        this.state = {
          ...this.state,
          stage,
          players
        }

        //afterEffects
        if(stage.name === 'STAGE_DEAL_CARDS') {
          this._dispatch(actions.dealCards())
        }
        break
      }

      case 'DEAL-CARDS': {
        const { availableBets, deck, players } = this.state
        const playersCards: {[playerName: string]: Array<Card> } = {}
        //Init with first draw
        for (const player of players) {
          playersCards[player.name] = [ this._drawCard() ]
        }
        const dealerCards: Array<Card> = [ this._drawCard() ]
        //append second draw
        for (const player of this.state.players) {
          playersCards[player.name].push(this._drawCard())
        }
        const dealerHoleCard = this._drawCard()
        const dealerValue = engine.calculate(dealerCards)
        let dealerHasBlackjack = engine.isBlackjack(dealerCards.concat([dealerHoleCard]))

        //init players'  sideBets, first hand and hand's history
        for (const player of players) {
          const { sideBetsFromUser, initialBet } = player
          const playerCards = playersCards[player.name]
          const firstHand = this.enforceRules(engine.getHandInfoAfterDeal(playerCards, dealerCards, initialBet))
          if(firstHand.playerHasBlackjack) {
            firstHand.close = true
          }
          player.hands = [ firstHand ]
          player.sideBetWins = {
            ...player.sideBetWins,
            ...engine.getSideBetsInfo(availableBets, sideBetsFromUser, playerCards, dealerCards.concat([dealerHoleCard]))
          }
        }

        //calculate next stage
        //next stage starting player.
        let startPlayer = players.findIndex(player => !player.hands[0].playerHasBlackjack)
        let stage: State['stage'] = {
           name: 'STAGE_PLAYERS_TURN', activePlayerId: startPlayer, activeHandId: 0
        }

        // ask for insurance bets
        // when dealer has ace we set the stage to ISURANCE
        if (dealerCards[0].value === 1) {
          stage = { name: 'STAGE_INSURANCE' }
        }

        this.state.history.push(appendEpoch({ type: 'DEAL-CARDS' } ))
        this.state = {
          ...this.state,
          players,
          deck,
          stage,
          dealerCards,
          dealerHoleCard,
          dealerValue,
          dealerHasBlackjack,
          availableBets: getDefaultSideBets(false)
        }

        //afterEffects
        //waiting for user action
        if(startPlayer === -1) {
          //all players have blackjack
          // purpose of the game archived !!!
          this._dispatch(actions.showdown())
          break
        }
        break
      }

      case 'INSURANCE': {
        // It can call only once per player
        // it can be called simultaneously
        // the prize will be in the sideBetWins
        // until the end of the game it should be hidden from the user
        if(action.payload === undefined) {
          throw Error('Payload is omitted')
        }
        const { bet, playerId } = action.payload
        if(bet === undefined || playerId === undefined) {
          throw Error('"bet" or "playerId" are omitted from the payload')
        }
        const player: Player = this.state.players[playerId]
        if(player.sideBetWins.insurance !== undefined) {
          throw Error(`Player '${player.name}' already make insurance decision`)
        }
        if(bet > player.initialBet / 2) {
          throw Error('"bet" can\'t be higher than the player\'s initialBet')
        }

        const { dealerCards, dealerHoleCard, history } = this.state
        let allDealerCards = dealerCards
        if(dealerHoleCard) {
          allDealerCards = dealerCards.concat([dealerHoleCard])
        }
        const dealerHasBlackjack = engine.isBlackjack(allDealerCards)
        const insuranceValue = bet > 0 ? bet : 0
        const isFirstCardAce = allDealerCards[0].value === 1
        const insurancePrize = (isFirstCardAce && dealerHasBlackjack && insuranceValue > 0 && bet > 0) ? insuranceValue * 2 : 0
        //set insurance to false on every hand
        player.hands.forEach(hand => hand.availableActions.insurance = false)
        player.sideBetWins = {
            ...player.sideBetWins,
            insurance: {
              risk: insuranceValue,
              win: insurancePrize
            }
        }

        //Alter state but not stage
        const historyItem = appendEpoch(({ type: 'INSURANCE', payload: { playerId } }))
        // this.state.players[playerId] = player //already set because of the reference
        this.state.history = history.concat(historyItem)
        const stage = this._getStageFromInsuranceStage()
        this.state.stage = stage;

        //afterEffects
        //wait for player interaction
        if(stage.name === 'STAGE_SHOWDOWN') {
          this._dispatch(actions.showdown())
        }

        break
      }

      case 'SPLIT': {
        const { activePlayerId, activeHandId } = this.getActivePlayer()
        const player: Player = this.state.players[activePlayerId]
        const { initialBet, hands } = player
        let splitHand = hands[activeHandId] //always has two cards
        const { rules, dealerCards, history } = this.state
        const newHandCards = [splitHand.cards[0]] //left one
        const splitHandCards = [splitHand.cards[1]] //right one
        const showdownAfterAceSplit = rules.showdownAfterAceSplit && newHandCards[ 0 ].value === 1

        //check we have hit split limit
        let canSplitAgain = true
        if(hands.length + 1 === rules.maxHandNumber) {
          hands.forEach(hand => {
            hand.availableActions.split = false
          })
          canSplitAgain = false
        }
        splitHand = this.enforceRules(engine.getHandInfoAfterSplit(splitHandCards, dealerCards, initialBet, canSplitAgain))
        let newHand = this.enforceRules(engine.getHandInfoAfterSplit(newHandCards, dealerCards, initialBet, canSplitAgain))

        if (showdownAfterAceSplit) {
          //draw one-one more cards then finish player's turn
          splitHandCards.push(this._drawCard())
          newHandCards.push(this._drawCard())
          splitHand = this.enforceRules(engine.getHandInfoAfterAceSplit(splitHandCards, dealerCards, initialBet))
          newHand = this.enforceRules(engine.getHandInfoAfterAceSplit(newHandCards, dealerCards, initialBet))
        }

        //set values into appropiate objects
        player.hands[activeHandId] = splitHand
        player.hands.push(newHand)
        this.state.players[activePlayerId] = player

        //init new state
        const stage = this._getStageFromPlayerTurn(activePlayerId)
        const historyItem = appendEpoch(({ type: 'SPLIT', payload: { playerId: activePlayerId, handId: activeHandId}}))
        this.state.stage = stage
        this.state.history = history.concat(historyItem)

        // AfterEffects
        if (stage.name === 'STAGE_SHOWDOWN') {
          this._dispatch(actions.showdown())
        }
        break
      }

      case 'HIT': {
        const { activePlayerId, activeHandId } = this.state.stage
        if(activePlayerId === undefined || activeHandId === undefined) {
          throw Error('"playerId" or "handId" are omitted from the stage')
        }
        const player = this.state.players[activePlayerId]
        let hand = player.hands[activeHandId]
        const { initialBet } = player
        const { dealerCards, history } = this.state
        const card = this._drawCard()
        hand.cards.push(card)
        hand = engine.getHandInfoAfterHit(hand.cards, dealerCards, initialBet, !hand.availableActions.split)
        player.hands[activeHandId] = hand

        //init next stage
        const stage = this._getStageFromPlayerTurn(activePlayerId)
        const historyItem = appendEpoch(({ type: 'HIT', payload: { playerId: activePlayerId, handId: activeHandId}}))
        this.state = ({
          ...this.state,
          stage,
          history: history.concat(historyItem)
        })

        //afterEffects
        if (stage.name === 'STAGE_SHOWDOWN') {
          this._dispatch(actions.showdown())
        }
        break
      }

      case 'DOUBLE': {
        const { activePlayerId, activeHandId } = this.getActivePlayer()
        const player = this.state.players[activePlayerId]
        let hand = player.hands[activeHandId]
        const { initialBet } = player
        const { dealerCards, history } = this.state
        const card = this._drawCard()
        hand.cards.push(card)
        hand = engine.getHandInfoAfterDouble(hand.cards, dealerCards, initialBet, !hand.availableActions.split)
        player.hands[activeHandId] = hand

        //init next stage
        //not necessary to init stage because we use stand
        const historyItem = appendEpoch(({ type: 'DOUBLE', payload: { playerId: activePlayerId, handId: activeHandId}}))
        this.state = ({
          ...this.state,
          //player already set because it was handled by reference
          history: history.concat(historyItem)
        })

        //afterEffects
        //force stand
        this._dispatch(actions.stand())
        break
      }

      case 'STAND': {
        const { activePlayerId, activeHandId } = this.getActivePlayer()
        const player = this.state.players[activePlayerId]
        let hand = player.hands[activeHandId]
        hand = engine.getHandInfoAfterStand(hand)
        player.hands[activeHandId] = hand

        const { history } = this.state
        const historyItem = appendEpoch({ type: 'STAND', payload: { playerId: activePlayerId, handId: activeHandId}})
        this.state.history = history.concat(historyItem)
        const stage = this._getStageFromPlayerTurn(activePlayerId)
        this.state.stage = stage

        if (stage.name === 'STAGE_SHOWDOWN') {
          this._dispatch(actions.showdown())
        }
        break
      }

      case 'SHOWDOWN': {
        const { dealerHoleCard, history, players } = this.state
        if(dealerHoleCard === null || dealerHoleCard === undefined) {
          throw new Error('Dealer hole card not set at showdown')
        }

        const historyItem = appendEpoch(action)
        this.state.stage = { name: 'STAGE_DEALER_TURN' }
        this.state.history = history.concat(historyItem)
        // we want to include in the calculation the dealerHoleCard obtained in initial deal()
        this._dispatch(actions.dealerHit(dealerHoleCard))

        //Check for the dealer has to draw further or not
        const check = players.every(
          player => player.hands.every(
            hand => hand.playerHasBusted || hand.playerHasBlackjack || hand.playerHasSurrendered
          )
        )
        if (check) {
          this.state = {
            ...this.state,
            stage: { name: 'STAGE_DONE' },
            players: engine.getPlayersWithPrizes(this.state.players, this.state.dealerCards)
          }
          break
        }

        while (this.state.stage.name === 'STAGE_DEALER_TURN') {
          this._dispatch(actions.dealerHit())
        }

        this.state = {
          ...this.state,
          stage: { name: 'STAGE_DONE' },
          players: engine.getPlayersWithPrizes(this.state.players, this.state.dealerCards)
        }
        break
      }

      case 'SURRENDER': {
        const { activePlayerId } = this.getActivePlayer()
        const player = this.state.players[activePlayerId]
        let hand = player.hands[0] //he/she has only one hand
        if(player.hands.length > 1) {
          throw Error('Many hands at surrender')
        }
        const { history } = this.state
        hand = engine.getHandInfoAfterSurrender(hand)
        player.hands[0] = hand
        //because the player's is reference not necessary to set again to state
        const historyItem = appendEpoch(({ type: 'STAND', payload: { playerId: activePlayerId } }))
        const stage = this._getStageFromPlayerTurn(activePlayerId)
        this.state = {
          ...this.state,
          stage,
          history: history.concat(historyItem),
        }

        if (stage.name === 'STAGE_SHOWDOWN') {
          this._dispatch(actions.showdown())
        }
        break
      }

      case 'DEALER-HIT': {
        const { rules, history } = this.state
        // the new card for dealer can be the "dealerHoleCard" or a new card
        // dealerHoleCard was set at the deal()
        // called from SHOWDOWN action
        // set STAGE_DONE when it finishes its actions
        const dealerHoleCard = action.payload && action.payload.dealerHoleCard ? action.payload.dealerHoleCard : null
        const card = dealerHoleCard || this._drawCard()
        const dealerCards = this.state.dealerCards.concat([card])
        const dealerValue = engine.calculate(dealerCards)
        const dealerHasBlackjack = engine.isBlackjack(dealerCards)
        const dealerHasBusted = dealerValue.hi > 21
        let stage: State['stage'] = { name: "STAGE_DEALER_TURN" }
        //calculate when it should be stopped
        if (dealerValue.hi >= 17) {
          if (dealerHasBusted || dealerHasBlackjack || (rules.standOnSoft17 && engine.isSoftHand(dealerCards))) {
            stage = { name: "STAGE_DONE" }
          }
        }
        if(dealerValue.lo >= 17) {
          stage = { name: "STAGE_DONE" }
        }
        const historyItem = appendEpoch(action)
        this.state = {
          ...this.state,
          stage,
          dealerCards,
          dealerValue,
          dealerHasBlackjack,
          dealerHasBusted,
          history: history.concat(historyItem),
        }
        break
      }

      default: {
        const { history } = this.state
        const historyItem = appendEpoch(action)
        this.state.history = history.concat(historyItem)
        break
      }
    }
    return this.getState()
  }

  private _drawCard (): Card {
    const card = this.state.deck.pop()
    if(card === undefined || card === null) {
      throw Error(`No more cards in the deck`)
    }
    this.state.cardCount += engine.countCards([card])
    return card
  }

  /// Get the next stage after the action in Insurence Stage
  /// the state's 'players' array has to be modified according to the action before use this function!
  private _getStageFromInsuranceStage(): State['stage'] {
    const { players } = this.state
    let hasPlayerUnderDecision = players.some(player => player.sideBetWins.insurance === undefined) //if insurance is not set, then decision hasn't made
    if (hasPlayerUnderDecision) {
      return { name: 'STAGE_INSURANCE' }
    } else {
      //jump to next stage Players_turn
      return this._getStageFromPlayerTurn(0) //can return PLAYERS_TURN or SHOWDOWN
    }
  }

  /// Get the next stage after the action in the Players Turn stage
  /// the state's 'players' array has to be modified according to the action before use this function!
  private _getStageFromPlayerTurn(fromPlayerId: number): State['stage'] {
    const { players } = this.state
    let playerId = fromPlayerId
    let handId = 0
    let gotNextPlayer = false
    //searching for not closed hands between players
    while (!gotNextPlayer && playerId < players.length) {
      const player = players[playerId]
      for(const [handIndex, hand] of player.hands.entries()) {
        console.log(`hand at user ${player.name}`, hand)
        if(!hand.close) {
          handId = handIndex
          gotNextPlayer = true
          break
        }
      }
      if(!gotNextPlayer) {
        playerId++
      }
    }
    if (!gotNextPlayer) {
      return { name: 'STAGE_SHOWDOWN' }
    } else {
      return {
        name: 'STAGE_PLAYERS_TURN',
        activePlayerId: playerId,
        activeHandId: handId
      }
    }
  }
}
