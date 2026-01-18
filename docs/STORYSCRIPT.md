# StoryScript — Adventure Game DSL

A domain-specific language for AI-generated, AI-playable point-and-click adventures.

---

## Design Goals

1. **AI-writable** — Clear structure agents can generate reliably
2. **AI-playable** — Agents can traverse, make choices, evaluate
3. **Human-readable** — Writers can review and edit
4. **Compilable** — Converts to Ink → Anima engine

---

## Basic Structure

```storyscript
GAME "Shadow Over Innsmouth"
  author: "Hermes Studio"
  version: 1.0

CHARACTERS
  hermes: "Hermes" (player)
    description: "Young folklorist, glasses, nervous energy"
  kat: "Kat"
    description: "Scruffy, guarded, searching for family"
  clerk: "Hotel Clerk"
    description: "Middle-aged, the Innsmouth look, wet voice"
  zadok: "Zadok Allen"
    description: "Town drunk, terrified, knows everything"

INVENTORY
  bus_ticket: "Bus Ticket" — "A one-way ticket to Innsmouth"
  whiskey: "Whiskey Bottle" — "Cheap rotgut. Zadok's currency."
  room_key: "Room Key" — "Gilman House, Room 7"
  notebook: "Notebook" — "Your research notes. Growing darker."
```

---

## Scene Definition

```storyscript
SCENE bus_station
  location: "Arkham Bus Depot"
  time: morning
  mood: uneasy
  background: "bus_station.png"
  music: "arkham_ambient.ogg"

  DESCRIPTION
    Diesel fumes hang in the air. Fluorescent lights flicker.
    A bored clerk sits behind scratched glass.
    The bus to Innsmouth leaves in ten minutes.
  END

  ON_ENTER
    hermes (thinks): "Everyone warned me not to go."
    hermes (thinks): "That's exactly why I have to."
  END

  HOTSPOT ticket_window [120, 200, 80, 100]
    name: "Ticket Window"
    LOOK
      "Scratched plexiglass. A faded schedule. Innsmouth: 2 departures daily."
    END
    TALK
      -> ticket_clerk_dialogue
    END
  END

  HOTSPOT bench [400, 300, 150, 80]
    name: "Waiting Bench"
    LOOK
      "A young woman sits alone. Dark hair, leather jacket."
      "She stares out the window. Headphones in."
      hermes (thinks): "Wonder where she's headed."
    END
    TALK
      "She doesn't notice you. Or pretends not to."
    END
  END

  HOTSPOT exit_door [600, 250, 50, 150]
    name: "Exit"
    USE
      IF NOT HAS(bus_ticket)
        "I should get my ticket first."
      ELSE
        -> bus_interior
      END
    END
  END
END
```

---

## Dialogue Trees

```storyscript
DIALOGUE ticket_clerk_dialogue
  clerk: "Help you?"
  
  CHOICE
    > "One ticket to Innsmouth."
      clerk: "Innsmouth?"
      clerk: "You sure about that, son?"
      CHOICE
        > "Just need the ticket."
          clerk: "Your funeral."
          GIVE bus_ticket
          hermes (thinks): "Friendly place."
          -> END
        > "Why? What's wrong with it?"
          clerk: "Nothing. Nothing at all."
          clerk: "That'll be two dollars."
          GIVE bus_ticket
          hermes (thinks): "He's lying."
          SET clerk_warned = true
          -> END
      END
    > "Where does that bus actually go?"
      clerk: "Innsmouth. Nowhere else stops there."
      clerk: "Smart folks take the long way around."
      -> ticket_clerk_dialogue
    > "Never mind."
      -> END
  END
END
```

---

## Triggers & Events

```storyscript
TRIGGER on_bus_depart
  REQUIRE HAS(bus_ticket)
  REQUIRE AT(bus_station)
  
  CUTSCENE
    "The bus groans to life."
    "Through the dirty window, Arkham shrinks away."
    "The woman with the dark hair sits three rows ahead."
    "She never looks back."
  END
  
  -> bus_interior
END
```

---

## Conditionals & State

```storyscript
IF HAS(whiskey) AND talked_to_zadok
  zadok: "You came back. With the good stuff."
  -> zadok_revelation
ELSE IF talked_to_zadok
  zadok: "Go away. They're watching."
ELSE
  zadok: "Who're you? Leave me alone."
END
```

---

## Puzzle Definition

```storyscript
PUZZLE get_whiskey
  description: "Zadok won't talk without booze"
  
  SOLUTION
    1. TALK grocery_clerk — refused ("We don't serve outsiders")
    2. FIND kat at waterfront
    3. ASK kat to buy whiskey (she's "kin")
    4. WAIT — she returns with bottle
    5. GIVE whiskey to zadok
  END
  
  HINTS
    1. "Zadok keeps looking at the general store..."
    2. "Maybe someone who looks local could help."
    3. "Kat said her family name was Marsh..."
  END
END
```

---

## Playtest Annotations

For AI playtesting, scenes include metadata:

```storyscript
SCENE hotel_lobby
  # PLAYTEST METADATA
  expected_duration: 3-5 minutes
  emotional_beat: unease, isolation
  tension_level: 4/10
  key_moment: "First glimpse of Kat up close"
  
  ...
END
```

Playtester agent reports:
```
SCENE: hotel_lobby
CHOICES_MADE: [looked at clerk, talked to clerk, examined stairs]
DURATION: 4 minutes
ENGAGEMENT: 7/10
PACING: 6/10 — "Wanted more interaction with Kat here"
CLARITY: 8/10
EMOTIONAL_HIT: "Clerk description was effectively creepy"
SUGGESTION: "Add a hotspot for the guest book — foreshadow Marsh name"
```

---

## Compilation Target

StoryScript compiles to:
1. **Ink** — Dialogue and branching logic
2. **Scene configs** — JSON for Anima engine
3. **Asset manifest** — Required backgrounds, sprites, audio

---

## File Extension

`.story` or `.ss`

---

## Next Steps

1. Write full Shadow over Innsmouth in StoryScript
2. Build parser (TypeScript)
3. Build AI traverser/playtester
4. Build compiler to Ink + Anima

