import { shuffle, newDecks } from '52-deck'
import { SideBets, Rule, State, Player } from '../types'

export const getDefaultSideBets = (active: boolean = false) : SideBets => {
  return {
    luckyLucky: active,
    perfectPairs: active,
    royalMatch: active,
    luckyLadies: active,
    inBet: active,
    MatchTheDealer: active
  }
}

export const getDefaultRules = (): Rule => {
  return {
    decks: 1,
    standOnSoft17: true,
    double: 'any',
    split: true,
    doubleAfterSplit: true,
    surrender: true,
    insurance: true,
    showdownAfterAceSplit: true,
    maxHandNumber: 4
  }
}

export const defaultPlayer = (name = "player-0"): Player => {
  return {
    name,
    initialBet: 0,
    finalBet: 0,
    finalWin: 0,
    sideBetsFromUser: {luckyLucky: 0, perfectPairs: 0},
    sideBetWins: {luckyLucky: 0, perfectPairs: 0},
    hands: []
  }
}

export const defaultState = (rules: Rule) : State => {
  return {
    players: [defaultPlayer()], //default only one player
    stage: { name: 'STAGE_READY' },
    deck: shuffle(newDecks(rules.decks)),
    availableBets: getDefaultSideBets(false),
    rules: rules,
    dealerHoleCard: null,
    dealerHasBlackjack: false,
    dealerHasBusted: false,
    dealerCards: [],
    dealerValue: {hi: 0, lo: 0},
    cardCount: 0,
    history: []
  }
}
