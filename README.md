## Available game parameters

There are many possible configuration. We are implementing _Standard_ and _Custom_ options
so that you can easily _combine flags_ to create games according with your skill/needs.

### Standard variations

 * number of `decks`, default is `1`
 * `standOnSoft17`, turn On/Off the "Soft 17" rule, default `true`
 * `double`, ability to double after deal, default `any`
    * `none` not allowed
    * `any` any allowed
    * `9or10`
    * `9or10or11`
    * `9thru15`
 * `split`, On/Off the possibility to split after deal, default `true`
 * `doubleAfterSplit`, On/Off the possibility to double after split (_split_ and _double_ must be "on"), default `true`
 * `surrender`, on/off the ability to surrender after deal, default `true`
 * `insurance`, on/off the ability of ensuring a hand, default `true`

## Install

If you are using [npm](https://www.npmjs.com/), to get the last version:

 * `yarn add blackjack-engine`
 * `npm install blackjack-engine`

## Quick Start

Once obtained the library just _require_ `Game` and `actions`.

```
const blackjack = require('blackjack-engine')
const actions = blackjack.actions
const Game = blackjack.Game
```

At this point you can initialize a _new game_ by calling the `Game constructor`.

### Creating a new game

```
const game = new Game()
```

In this cases, no state is passed to the constructor:

 1. the _default_ state is loaded into _game_
 2. _game_ is ready to _`dispatch` actions_ to alter the state

### Getting current state

At any moment we can require the current state of the _game_ by calling the `getState()`.

```
console.dir(game.getState())
```

The content of the state and its _schema_ depends on the _stage_ of the game. In this case
we initialized the game without any precedent state, so we will receive something like this:

For the moment the only thing we should note is that the _field_ `stage` tells us "game is ready".

### Dispatching actions

The only way *to mutate the state of the game* is to dispatch actions. Some actions are required by the "user",
some other actions are dispatched by the engine to "complete" the game.

NOTE: In a real game, players and dealer are allowed to "do actions". The engine will "impersonate the dealer" at some point, depending on the _last action_ and the _state_.

```
// stage is "ready"
console.log(game.getState().stage)

// call an action to mutate the state
game.dispatch(actions.deal())

// stage has changed
console.log(game.getState().stage)
```

## Project Structure

Based on (Marco Casula's project)[https://github.com/kedoska/engine-blackjack/].

### Actions

see the `/src/actions.js`

Engine exposes _actions_, once invoked, the state of the game is changed.
The following list represent the _actions_ that can be _dispatched_ by from the public API.

 * bet
 * insurance
 * double
 * split
 * hit
 * stand
 * surrender

And, those are _actions_ that are internally called in determinate _stages_ by the engine itself.

 * deal-cards
 * showdown
 * dealerHit
 * invalid

### Stages

See the `/src/game.ts`

The stage represent a moment in the game. The stage is directly related with the action allowed in that particular moment.

Current available stages for players are:

 * ready
 * insurance
 * players-turn
 * showdown
 * dealer-turn
 * done

### Logic

The game logic is implemented into `/src/engine.ts`.
There is a specific design limitation currently in the code.

NOTE: If you are interested in the random components, check out the `shuffle()` function.

## Test

Run tests by calling `yarn test ` or `npm test`

[Jest](https://facebook.github.io/jest/) will care about the following tasks:
 - create a new game
 - initialize it by injecting `♠10 ♦1 ♥5 ♣6 ♠11 ♦10` at the and of the _deck_
 - run the desired `restore`, `deal`, `split`, `insurance` and finally `stand`
 - return the current state
 - compare if `stage` is 'done' at the end

If you specify the `finalWin` the test will compare the final winning.
