import { Action, Card, SideBetsFromUser } from '../types'

export const invalid = (action: Action, info: any): Action => {
  return {
    type: 'INVALID',
    payload: {
      type: action.type,
      payload: action.payload,
      info: info
    }
  }
}

export const restore = (): Action => {
  return {
    type: 'RESTORE'
  }
}

export const bet = ({ bet = 10, playerId, sideBets = { luckyLucky: 0, perfectPairs: 0 } }: { bet: number, playerId: number, sideBets?: SideBetsFromUser }): Action => {
  return {
    type: 'BET',
    payload: {
      bet,
      sideBets,
      playerId
    }
  }
}

export const dealCards = (): Action => {
  return {
    type: 'DEAL-CARDS',
  }
}

export const insurance = ({ bet = 0, playerId }: { bet: number, playerId: number }): Action => {
  return {
    type: 'INSURANCE',
    payload: {
      bet,
      playerId
    }
  }
}

export const split = (): Action => {
  return {
    type: 'SPLIT'
  }
}

export const hit = (): Action => {
  return {
    type: 'HIT'
  }
}

export const double = (): Action => {
  return {
    type: 'DOUBLE'
  }
}

export const stand = (): Action => {
  return {
    type: 'STAND'
  }
}

export const surrender = (): Action => {
  return {
    type: 'SURRENDER'
  }
}

export const showdown = (): Action => {
  return {
    type: 'SHOWDOWN',
    // payload: {
    //   dealerHoleCardOnly: dealerHoleCardOnly ? dealerHoleCardOnly : false
    // }
  }
}

export const dealerHit = (dealerHoleCard?: Card): Action => {
  return {
    type: 'DEALER-HIT',
    payload: {
      dealerHoleCard
    }
  }
}
