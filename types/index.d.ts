export interface Action {
  type:
  | 'BET'
  | 'INSURANCE'
  | 'SPLIT'
  | 'HIT'
  | 'DOUBLE'
  | 'STAND'
  | 'SURRENDER'
  | 'DEALER-HIT'
  | 'INVALID'
  | 'RESTORE'
  | 'SHOWDOWN'
  | 'DEAL-CARDS';
  payload?: ActionPayload;
}

export interface ActionPayload {
  bet?: number; //only at BET, INSURANCE action
  playerId?: number; //only at BET action
  handId?: number; //position was ->
  sideBets?: SideBetsFromUser; //at BET
  type?: Action['type']; //at invalid action
  payload?: ActionPayload; //at invalid action
  info?: any; //at invalid action
  dealerHoleCard?: Card; //at dealerHit
}

export interface SideBets {
  luckyLucky: boolean;
  perfectPairs: boolean;
  royalMatch: boolean;
  luckyLadies: boolean;
  inBet: boolean;
  MatchTheDealer: boolean;
}

export interface AvailableActions {
  double: boolean;
  split: boolean;
  insurance: boolean;
  hit: boolean;
  stand: boolean;
  surrender: boolean;
}

export interface Card {
  text:
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';
  suite: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  value: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;
  color: 'R' | 'B';
}

export interface HandValue {
  hi: number;
  lo: number;
}

export interface Hand {
  bet?: number; //after Deal, Hit, Split, Double
  cards: Card[];
  playerValue: HandValue;
  playerHasBlackjack: boolean;
  playerHasBusted: boolean;
  playerHasSurrendered: boolean;
  availableActions: AvailableActions;
  close: boolean; //no more moves
}

export interface SideBets {
  luckyLucky: boolean;
  perfectPairs: boolean;
  royalMatch: boolean;
  luckyLadies: boolean;
  inBet: boolean;
  MatchTheDealer: boolean;
}

export interface Rule {
  decks: number;
  standOnSoft17: boolean;
  double: 'any' | '9or10' | '9or10or11' | '9thru15' | 'none';
  doubleAfterSplit: boolean;
  split: boolean;
  surrender: boolean;
  insurance: boolean;
  showdownAfterAceSplit: boolean;
  maxHandNumber: number; //maximum approved splits for a player in a turn
}

export interface HistoryItem {
  action: Action;
  ts?: number //at appendEpoch
}

type ControlAction = 'NEW_ROUND'

export interface Player {
  name: string;
  initialBet: number;
  sideBetsFromUser: SideBetsFromUser; //at BET
  sideBetWins: SideBetsInfo; //already calculated sideBets
  finalBet?: number;
  finalWin: number;
  hands: Array<Hand>;
}

export interface SideBetsFromUser {
  luckyLucky?: number;
  perfectPairs?: number;
}

export interface State {
  players: Array<Player>,
  stage: {
    name: 'STAGE_READY'
    | 'STAGE_DEAL_CARDS'
    | 'STAGE_INSURANCE' //optional: when the dealer has ace, and the state allowed the insurance rule
    | 'STAGE_PLAYERS_TURN'
    | 'STAGE_SHOWDOWN'
    | 'STAGE_DEALER_TURN'
    | 'STAGE_DONE';
    activePlayerId?: number; //only at STAGE_PLAYERS_TURN
    activeHandId?: number; //only at STAGE_PLAYERS_TURN
  }
  deck: Card[];
  rules: Rule;
  dealerCards: Card[];
  dealerHoleCard: Card | undefined | null;
  dealerHasBlackjack: boolean;
  dealerHasBusted: boolean;
  dealerValue: HandValue;
  cardCount: number;
  availableBets: SideBets;
  history: Array<HistoryItem>;
}

export interface SideBetsInfo {
  insurance?: { risk: number, win: number } //only show for user when SHOWDOWN happens
  luckyLucky?: number;
  perfectPairs?: number;
}

export class Game {
  public static canDouble(
    double: Rule['double'],
    playerValue: HandValue
  ): boolean;
  constructor(initialState?: State, rules?: Rule);
  public dispatch(action: Action): State;
  public enforceRules(handInfo: Hand): Hand;
  public getState(): State;
  public setState(state: Partial<State>): void;
  public getActivePlayer(): { activePlayerId: number, activeHandId: number };
}

//-> move to Game
export namespace actions {
  function bet(bet: number, playerId: number, sideBets?: SideBetsInfo): Action;
  // function dealCards
  // function dealerHit(options?: { dealerHoleCard: Card }): Action;
  function hit(): Action;
  function insurance(bet: number, playerId: number): Action;
  // function invalid(action: Action, info: string): Action;
  function restore(): Action;
  // function showdown(options?: { dealerHoleCardOnly: boolean }): Action;
  function split(): Action;
  function stand(): Action;
  function surrender(): Action;
  function double(): Action;
}

export namespace engine {
  function calculate(cards: Card[]): HandValue;
  function checkForBusted(handValue: HandValue): boolean;
  function countCards(cards: Card[]): number;
  function getHandInfo(
    playerCards: Card[],
    dealerCards: Card[],
    hasSplit?: boolean
  ): Hand;
  function getHandInfoAfterDeal(
    playerCards: Card[],
    dealerCards: Card[],
    initialBet: number
  ): Hand;
  function getHandInfoAfterDouble(
    playerCards: Card[],
    dealerCards: Card[],
    initialBet: number,
    hasSplit: boolean
  ): Hand;
  function getHandInfoAfterHit(
    playerCards: Card[],
    dealerCards: Card[],
    initialBet: number,
    hasSplit: boolean
  ): Hand;
  function getHandInfoAfterInsurance(
    playerCards: Card[],
    dealerCards: Card[]
  ): Hand;
  function getHandInfoAfterSplit(
    playerCards: Card[],
    dealerCards: Card[],
    initialBet: number
  ): Hand;
  function getPrize(playerHand: Hand, dealerCards: Card[]): number;
  function getPrizes(gameInfo: {
    handsInfo: Array<Hand>;
    dealerCards: Array<Card>;
  }): { wonPrizesPerHand: Array<number> };
  //checking functions
  function isActionAllowed(actionName: string, stage: string): boolean;
  function isBlackjack(cards: Card[]): boolean;
  function isLuckyLucky(
      playerCards: Card[],
      dealerCards: Card[]
  ): boolean;
  function isNull(obj: any): boolean;
  function isNullOrUndef(obj: any): boolean;
  function isPerfectPairs(playerCards: Card[]): boolean;
  function isSoftHand(cards: Card[]): boolean;
  function isSuited(cards: Card[]): boolean;
  function isUndefined(obj: any): boolean;
}

export namespace presets {
  function defaultState(rules: Rule): State;
  function getRules(): Rule;
  function getDefaultRules(): Rule;
  function defaultPlayer(): Player;
}
