# Design

## Visual

Warm paper background, dark type, one orange action colour, restrained borders, and large headlines. The UI is deliberately quiet so the task list stays the main object.

## Flow

Expo Router owns the route tree. The root route checks restored auth state, profile state, and task selection, then sends the user to the next incomplete step.

## State

Auth state is kept in one context. API calls share one client for headers and error parsing. The access token lives in SecureStore on native devices.

## Network UX

Loading states block duplicate submits. Empty states explain what to do next. Failed requests show the server message and a retry action where retrying makes sense.

## Accessibility

Inputs have labels and native keyboard types. Task choices expose checkbox semantics and checked state. Primary controls have stable test IDs.

## Scope

Only the brief's onboarding journey is implemented. Nothing is faked to suggest production task tracking that the API does not provide.
