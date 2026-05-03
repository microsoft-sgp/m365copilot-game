## ADDED Requirements

### Requirement: New Board rerolls assigned pack

The frontend SHALL treat New Board as a server-authoritative pack reroll. When the player confirms New Board from an active board, the frontend SHALL request an assignment reroll, replace local board state only after the server returns the new assignment, and start a fresh board for the returned pack and game session.

#### Scenario: Player confirms New Board reroll

- **GIVEN** a player has an active board with a gameSessionId and assigned pack
- **WHEN** the player clicks New Board and confirms the action
- **THEN** the frontend MUST call the assignment reroll API before clearing local board state
- **AND** the frontend MUST initialize a fresh 3x3 board using the returned packId and gameSessionId

#### Scenario: Player declines New Board confirmation

- **GIVEN** a player has an active board
- **WHEN** the player clicks New Board and declines the confirmation
- **THEN** the frontend MUST leave the current board, progress, assigned pack, and gameSessionId unchanged

#### Scenario: Reroll failure preserves current board

- **GIVEN** a player has an active board
- **WHEN** the player confirms New Board and the reroll API fails or returns an error
- **THEN** the frontend MUST keep the current board active and MUST NOT clear local progress

#### Scenario: Reroll success clears old progress locally

- **GIVEN** a player has cleared tiles, won lines, or earned keywords on the current board
- **WHEN** the New Board reroll succeeds
- **THEN** the frontend MUST clear local tile progress, won lines, and board keywords for the new board while preserving player identity

#### Scenario: New Board copy explains pack replacement

- **GIVEN** a player clicks New Board
- **WHEN** the confirmation is shown
- **THEN** the copy MUST explain that current board progress will be cleared and a new pack will be assigned

#### Scenario: Setup copy does not describe rerolled pack as locked

- **GIVEN** the player is on the setup view after assignment hydration or reroll
- **WHEN** the assigned-pack status text is rendered
- **THEN** the frontend MUST NOT tell the player the pack is locked for the challenge cycle
