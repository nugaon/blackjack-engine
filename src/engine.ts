import luckyLucky from './paytables/luckyLucky'
import * as TYPES from './constants'
import {
  SideBets,
  Card,
  Hand,
  HandValue,
  State,
  Action,
  Player,
  SideBetsFromUser
} from '../types'

export const isNull = (obj: any): boolean => obj === null

export const isUndefined = (obj: any): boolean => obj === undefined

export const isNullOrUndef = (obj: any): boolean => isUndefined(obj) || isNull(obj)

/// Calculate the value of the Cards according to the BlackJack rules.
export const calculate = (array: Array<Card>): HandValue => {
  if (array.length === 1) {
    if (isNullOrUndef(array[0])) {
      return {
        hi: 0,
        lo: 0
      }
    }
    const value = array[0].value
    return {
      hi: value === 1 ? 11 : value,
      lo: value === 1 ? 1 : value
    }
  }
  const aces: Array<number> = []
  const value = array.reduce((memo, x) => {
    if (x.value === 1) {
      aces.push(1)
      return memo
    }
    memo += x.value
    return memo
  }, 0)
  return aces.reduce((memo) => {
    if ((memo.hi + 11) <= 21) {
      memo.hi += 11
      memo.lo += 1
    } else {
      memo.hi += 1
      memo.lo += 1
    }
    if (memo.hi > 21 && memo.lo <= 21) {
      memo.hi = memo.lo
    }
    return memo
  }, {
    hi: value,
    lo: value
  })
}

/// Get the highest valid value from the given cards
export const getHigherValidValue = (handValue: HandValue):number => handValue.hi <= 21 ? handValue.hi : handValue.lo

export const checkForBusted = (handValue: HandValue): boolean => (handValue.hi > 21) && (handValue.lo === handValue.hi)

export const isBlackjack = (array: Array<Card>): boolean => array.length === 2 && calculate(array).hi === 21

/// at value 17 it sends back true
export const isSoftHand = (array: Array<Card>): boolean => {
  return array.some(x => x.value === 1) &&
    array
      .reduce((memo, x) => {
        memo += (x.value === 1 && memo < 11) ? 11 : x.value
        return memo
      }, 0) === 17
}

/// Return true if the cards are in the same suite (hearts, diamonds, clubs, spades)
export const isSuited = (array: Array<Card> = []): boolean => {
  if (array.length === 0) {
    return false
  }
  const suite = array[0].suite
  return array.every(x => x.suite === suite)
}

/// Counting cards by the jackblack way -> https://www.youtube.com/watch?v=LrCOHrQz7no
export const countCards = (array: Array<Card>) => {
  const systems = {
    'Hi-Lo': [ -1, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1 ]
  }
  return array.reduce((memo, x) => {
    memo += systems['Hi-Lo'][x.value - 1]
    return memo
  }, 0)
}

///Inits Hand with bet: 0, that can be assigned later
export const getHandInfoInit = (playerCards: Array<Card>, dealerCards: Array<Card>, hasSplit = false): Hand => {
  const handValue = calculate(playerCards)
  if (!handValue) {
    throw Error(`${playerCards} cards don't have value`)
  }
  const hasBlackjack = isBlackjack(playerCards) && hasSplit === false
  const hasBusted = checkForBusted(handValue)
  const isClosed = hasBusted || hasBlackjack || handValue.hi === 21
  const canDoubleDown = !isClosed && true
  const canSplit = playerCards.length > 1 && playerCards[ 0 ].value === playerCards[ 1 ].value && !isClosed
  const canInsure = dealerCards[ 0 ].value === 1 && !isClosed
  return {
    bet: 0,
    cards: playerCards,
    playerValue: handValue,
    playerHasBlackjack: hasBlackjack,
    playerHasBusted: hasBusted,
    playerHasSurrendered: false,
    close: isClosed,
    availableActions: {
      double: canDoubleDown,
      split: canSplit,
      insurance: canInsure,
      hit: !isClosed,
      stand: !isClosed,
      surrender: !isClosed
    }
  }
}

export const getHandInfoAfterDeal = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number): Hand => {
  const hand = getHandInfoInit(playerCards, dealerCards)
  hand.bet = initialBet
  // After deal, even if we got a blackjack the hand cannot be considered closed.
  const availableActions = hand.availableActions
  hand.availableActions = {
    ...availableActions,
    stand: true,
    hit: true,
    surrender: true
  }
  return {
    ...hand,
    close: hand.playerHasBlackjack
  }
}

export const getHandInfoAfterSplit = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number, canSplitAgain: boolean): Hand => {
  const hand = getHandInfoInit(playerCards, dealerCards, true)
  const availableActions = hand.availableActions
  hand.availableActions = {
    ...availableActions,
    split: canSplitAgain,
    double: !hand.close && (playerCards.length === 2),
    insurance: false,
    surrender: false
  }
  hand.bet = initialBet
  return hand
}

export const getHandInfoAfterHit = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number, hasSplit: boolean): Hand => {
  const hand = getHandInfoInit(playerCards, dealerCards, hasSplit)
  const availableActions = hand.availableActions
  hand.availableActions = {
    ...availableActions,
    double: (playerCards.length === 2),
    split: false,
    insurance: false,
    surrender: false
  }
  hand.bet = initialBet
  return hand
}

export const getHandInfoAfterDouble = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number, hasSplit: boolean): Hand => {
  const hand = getHandInfoAfterHit(playerCards, dealerCards, initialBet, hasSplit)
  const availableActions = hand.availableActions
  hand.availableActions = {
    ...availableActions,
    hit: false,
    stand: false
  }
  hand.bet = initialBet * 2
  return {
    ...hand,
    close: true
  }
}

export const getHandInfoAfterStand = (handInfo: Hand): Hand => {
  return {
    ...handInfo,
    close: true,
    availableActions: {
      double: false,
      split: false,
      insurance: false,
      hit: false,
      stand: false,
      surrender: false
    }
  }
}

export const getHandInfoAfterSurrender = (handInfo: Hand): Hand => {
  const hand = getHandInfoAfterStand(handInfo)
  return {
    ...hand,
    playerHasSurrendered: true,
    close: true
  }
}

// Only use when showdownAfterAceSplit rule is true!
export const getHandInfoAfterAceSplit = (playerCards: Array<Card>, dealerCards: Array<Card>, initialBet: number): Hand => {
  const hand = getHandInfoInit(playerCards, dealerCards, true)
  const availableActions = hand.availableActions
  for (const actionIndex in hand.availableActions) {
    availableActions[actionIndex] = false
  }
  hand.bet = initialBet
  hand.close = true
  return hand
}

export const canDouble = (double: 'any' | 'none' | '9or10' | '9or10or11' | '9thru15', playerValue: HandValue): boolean  => {
  if (double === 'none') {
    return false
  } else if (double === '9or10') {
    return ((playerValue.hi === 9) || (playerValue.hi === 10))
  } else if (double === '9or10or11') {
    return ((playerValue.hi >= 9) && (playerValue.hi <= 11))
  } else if (double === '9thru15') {
    return ((playerValue.hi >= 9) && (playerValue.hi <= 15))
  } else {
    return true
  }
}

export const isLuckyLucky = (playerCards: Array<Card>, dealerCards: Array<Card>): boolean => {
  // Player hand and dealer's up card sum to 19, 20, or 21 ("Lucky Lucky")
  const v1 = calculate(playerCards).hi + calculate(dealerCards).hi
  const v2 = calculate(playerCards).lo + calculate(dealerCards).lo
  const v3 = calculate(playerCards).hi + calculate(dealerCards).lo
  const v4 = calculate(playerCards).lo + calculate(dealerCards).hi
  return (v1 >= 19 && v1 <= 21) || (v2 >= 19 && v2 <= 21) || (v3 >= 19 && v3 <= 21) || (v4 >= 19 && v4 <= 21)
}

/// According to the luckyLucky table (which needs the flat and same suite cards) returns back its multiplier
export const getLuckyLuckyMultiplier = (playerCards: Array<Card>, dealerCards: Array<Card>) => {
  const cards: Array<Card> = [...playerCards, ...dealerCards]
  const isSameSuite = isSuited(cards)
  const flatCards = cards.map(x => x.value).join('')
  const value = calculate(cards)
  return luckyLucky(flatCards, isSameSuite, value)
}

/// Returns true if the first 2 cards have the same value
export const isPerfectPairs = (playerCards: Array<Card>): boolean => playerCards[0].value === playerCards[1].value

/// Calculate insurance winning for the player
/// Should be called with the dealer all cards!
export const getSideBetsInfo = (availableBets: SideBets, sideBets: SideBetsFromUser, playerCards: Array<Card>, dealerCards: Array<Card>): SideBetsFromUser => {
  const sideBetsInfo = {
    luckyLucky: 0,
    perfectPairs: 0
  }
  if (availableBets.luckyLucky && sideBets.luckyLucky && isLuckyLucky(playerCards, dealerCards)) {
    const multiplier = getLuckyLuckyMultiplier(playerCards, dealerCards)
    sideBetsInfo.luckyLucky = sideBets.luckyLucky * multiplier
  }
  if (availableBets.perfectPairs && sideBets.perfectPairs && isPerfectPairs(playerCards)) {
    // TODO: impl colored pairs
    // TODO: impl mixed pairs
    sideBetsInfo.perfectPairs = sideBets.perfectPairs * 5
  }
  return sideBetsInfo
}

export const checkActionAllowed = (action: Action, state: State): boolean => {
  //Check whitelisted actions
  const stageName = state.stage.name

  if (action.type === 'BET' && (!action.payload || typeof action.payload.bet !== 'number')) {
    throw new Error(`${action.type} without bet value on stage ${state.stage}`)
  }

  switch (stageName) {
    case 'STAGE_READY': {
      if (!action.payload) {
        throw Error(`No action payload`)
      }
      const { bet, playerId } = action.payload
      if (!bet || !playerId) {
        throw Error(`Omitted 'bet' or 'playerId' params from the action payload`)
      }
      const activePlayer: Player = state.players[playerId];
      return ['BET'].indexOf(action.type) > -1
    }
    case 'STAGE_DEAL_CARDS': {
      return ['DEAL-CARDS'].indexOf(action.type) > -1
    }
    case 'STAGE_INSURANCE': {
      if(!state.rules['insurance']) {
        throw new Error(`Not allowed stage, because of the set rules`)
      }
      return ['INSURANCE'].indexOf(action.type) > -1
    }
    case 'STAGE_PLAYERS_TURN': {
      if(!state.stage.activePlayerId || !state.stage.activeHandId) {
        throw new Error(`'activePlayerId' and/or 'activeHandId' haven't been set in state`)
      }
      const activePlayerId = state.stage.activePlayerId
      const activeHandId = state.stage.activeHandId
      const activePlayer: Player = state.players[state.stage.activePlayerId];
      const activeHand: Hand = activePlayer.hands[state.stage.activeHandId];
      if (activeHand.close) {
        throw new Error(`${action.type} is not allowed because "${activeHandId}" hand of player ${activePlayerId} is closed on "${stageName}"`)
      }
      if(activePlayer.hands.slice(0, state.stage.activeHandId).some(x => !x.close)) {
        throw new Error(`${action.type} is not allowed on hand ${activeHandId} for user ${activePlayerId} because you need to finish a hand before`)
      }
      if (!activeHand.availableActions[action.type.toLowerCase()]) {
        throw new Error(`${action.type} is not currently allowed on hand "${activeHandId}". Stage is "${stageName}"`)
      }
      return [TYPES.STAND, TYPES.SURRENDER, TYPES.SPLIT, TYPES.HIT, TYPES.DOUBLE].indexOf(action.type) > -1
    }
    case TYPES.SHOWDOWN: {
      return [TYPES.SHOWDOWN, TYPES.STAND].indexOf(action.type) > -1
    }
    case TYPES.STAGE_DEALER_TURN: {
      return [TYPES.DEALER_HIT].indexOf(action.type) > -1
    }
    default: {
      return false
    }
  }
}

/// Returns 0 if the player lose the round
export const getPrize = (playerHand: Hand, dealerCards: Array<Card>): number => {
  const {
    playerHasSurrendered = true,
    playerHasBlackjack = false,
    playerHasBusted = true,
    playerValue = {hi: 0, lo: 0},
    bet = 0
  } = playerHand
  const higherValidDealerValue = getHigherValidValue(calculate(dealerCards))
  const dealerHasBlackjack = isBlackjack(dealerCards)
  if (playerHasBusted) {
    return 0
  }
  if (playerHasSurrendered) {
    return bet / 2
  }
  if (playerHasBlackjack && !dealerHasBlackjack) {
    return bet + (bet * 1.5)
  }
  const dealerHasBusted = higherValidDealerValue > 21
  if (dealerHasBusted) {
    return (bet + bet)
  }
  const higherValidPlayerValue = getHigherValidValue(playerValue)
  if (higherValidPlayerValue > higherValidDealerValue) {
    return (bet + bet)
  } else if (higherValidPlayerValue === higherValidDealerValue) {
    return bet
  }
  return 0
}

/// Return the given Players array with its prizes
export const getPlayersWithPrizes = (players: Array<Player>, dealerCards: Array<Card>): Array<Player> => {
  const playersWithPrizes = [...players]
  for (const player of playersWithPrizes) {
    for (const hand of player.hands) {
      player.finalWin += getPrize(hand, dealerCards)
    }
  }
  return playersWithPrizes
}
