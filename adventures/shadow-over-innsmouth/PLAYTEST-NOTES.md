# Shadow Over Innsmouth — Playtest Notes

**Playtester:** Innsmouth Subagent  
**Date:** 2026-01-19  
**Version:** StoryScript Interpreter (direct playtest + source review)

---

## Critical Bugs / Broken Transitions

### 1. Bus Scene Progression Completely Broken ⚠️
The `bus_arrives` trigger never fires. The interpreter doesn't implement:
- `AFTER X minutes` time-based triggers
- Counter variables (`window_looked`, `bus_progress`)
- Conditional branching inside LOOK blocks (the `IF bus_progress < 1` logic)

**Result:** Player is stuck on the bus indefinitely. Cannot proceed to Innsmouth.

**Fix needed:** Either implement AFTER triggers and counters in interpreter, OR add a manual progression hotspot (e.g., "wait" action that advances time).

### 2. Kat Bus Dialogue Never Fires
When talking to "Woman in Back" on the bus, the interpreter immediately says "She's got her headphones back in" without ever running `kat_bus_dialogue`.

**Cause:** The `IF NOT talked_to_kat_bus` conditional inside the TALK block isn't being parsed correctly. The interpreter jumps to the ELSE branch immediately.

**Impact:** Players never get the three dialogue options with Kat, missing:
- Establishing Kat's personality
- Learning she's going to find "family"
- Setting `kat_revealed_family = true` (affects later scenes)

### 3. Repeated "Help you?" Lines
In `ticket_clerk_dialogue`, the line `clerk: "Help you?"` appears at the top of the dialogue AND inside option branches, creating awkward repetition:
```
> Buy ticket
clerk: "Help you?"  <- This shouldn't be here
clerk: "Innsmouth?"
```

---

## Pacing Analysis

### Act 1: Arrival (Good start, broken ending)
- **Arkham Bus Depot:** Pacing is good. 5-6 hotspots, each adds atmosphere. The "DONT GO" scratched into the counter is effective foreshadowing.
- **Bus Scene:** TOO SHORT even if it worked. Only 4 hotspots. The window should show 3 different descriptions as the journey progresses (farmland → marshes → fog), but this never happens.
- **Recommendation:** Add more bus content. A longer ride builds dread.

### Act 2: Investigation (Zadok exposition is heavy but justified)
- **Zadok's infodump** is indeed heavy: 15+ lines of exposition about Deep Ones, breeding, Dagon.
- **BUT:** It works because:
  1. Player has already seen weird things (the Look, the fishermen)
  2. Zadok is drunk and terrified — the delivery matters
  3. It's the payoff for the whole mystery
- **Recommendation:** Break Zadok's speech into 2-3 beats with player interjections. Let player ask "Wait, what?" more.

### Act 3: The Chase (Intentionally railroad — works)
- This is meant to be a rush. The lack of agency IS the point.
- **However:** Church scene feels too fast. The congregation should react more. Add creepy ambient descriptions as you walk through them.
- The chase through alleys could use one more beat of "almost caught."

### Act 4: The Sea (Emotionally heavy, appropriately slow)
- Pacing is perfect for a melancholy ending.
- The year-later timeskip is effective.
- **The dream sequence** is the emotional core — give it more room to breathe.

---

## Dialogue That Doesn't Sound Natural

### Clunky Lines:
1. **Act 1, Clerk:**
   > "It's your business, I suppose."
   
   Sounds too formal. Try: "Your funeral" or just silence with ticket-pushing.

2. **Act 2, Kat in Library:**
   > "In the breeding records."
   
   Too on-the-nose. She'd say something more broken: "In the... they kept records. Of pairings." Let the horror build.

3. **Act 2, Zadok:**
   > "Breeding. They wanted to breed with us."
   
   The repetition of "breeding" is awkward. Try: "They wanted... children. Human-enough children."

4. **Act 4, Dream Kat:**
   > "It just... happens."
   
   Weak line for a supernatural entity. She should sound more alien: "The blood calls. I can't stop it."

### Lines That Work Well:
- "She's got the blood. Strong blood." (Zadok) — perfect folk horror cadence
- "Even the parts I was afraid of." (Final Kat) — emotionally devastating
- "That's what love is. Showing up even when you know how it ends." — earned by the story

---

## Emotional Beat Assessment

### THE LOOK — Church Scene (Act 3)
**Setup:**
> "She looks at you. Really looks."
> "THE LOOK. The one you'll remember forever."

**Verdict:** ✅ LANDS. The moment is properly signposted, and her dialogue immediately after ("I can hear them, Hermes") earns the weight. The physical detail of cold, webbed fingers is visceral.

**Enhancement suggestion:** Add a beat of silence. A pause. Let it breathe:
```
"She looks at you. Really looks."
"..."
"THE LOOK. The one you'll remember forever."
```

### THE LOOK — Beach Scene (Act 4)
**Setup:**
> "She looks at you. THE LOOK again."
> "The same one from the church."
> "The one that says: I see you. All of you."

**Verdict:** ✅ LANDS HARDER because we remember the first one. The callback works.

**Enhancement suggestion:** This is where the player should have a physical reaction:
```
hermes (thinks): "I know that look."
hermes (thinks): "I've been waiting a year to see it again."
```

### Other Emotional Beats:
- **Kat revealing her name is Marsh:** Works. The gold flicker in her eyes is creepy.
- **Zadok being taken:** Happens too fast. "Zadok is gone. Pulled into the dark." needs more terror.
- **Final choice on beach:** Both options lead to same ending — this is intentional and correct. Some choices shouldn't matter. Love is love.

---

## Player Agency Analysis

| Act | Agency Level | Notes |
|-----|--------------|-------|
| 1 | Medium | Can explore depot freely. Bus is linear. |
| 2 | High | Multiple locations, optional conversations. Best exploration. |
| 3 | Low | Intentional railroad (chase). Two "choices" that aren't (hide → still go in). |
| 4 | Minimal | One real choice at the end (both lead to same outcome). |

### Is It a Railroad?
**Mostly, yes.** But this is a story about fate and blood-destiny. Kat can't escape what she is. Hermes can't save her. The railroad is the point.

**However:** Act 2 needs more meaningful choices:
- Can Hermes avoid the grocery store owner triggering hostility?
- What if he doesn't meet Zadok? (Currently seems required)
- More dialogue branches with Kat that affect her trust level

**Missing agency that should exist:**
- Choosing to flee Innsmouth early (and failing)
- Attempting to warn authorities (and being disbelieved)
- An alternate path where Hermes joins Kat (nihilistic ending)

---

## Missing Hotspots / Actions That Should Exist

### Act 1:
- [ ] **Bus:** Can't examine the bus ticket in inventory
- [ ] **Bus:** No way to read from notebook/book to pass time
- [ ] **Bus:** Looking at window should have 3 states (farmland → marsh → fog) — progression logic broken
- [ ] **Bus:** No "wait" or "sleep" command to force progression

### Act 2:
- [ ] **Town Square:** Can't look at the fountain (described in scene)
- [ ] **Harbor:** Can't look at Devil Reef through binoculars (should require finding them first)
- [ ] **Library:** Can't look at the boarded windows from inside
- [ ] **Hotel Evening:** Can't look at what's in the clerk's desk (missed opportunity)

### Act 3:
- [ ] **Church Interior:** Can't look at the altar itself (only Kat at altar)
- [ ] **Church Interior:** Can't look at specific congregation members
- [ ] **Escape:** No way to grab a weapon or item for psychological comfort

### Act 4:
- [ ] **Apartment:** Can't examine the bottle (alcoholism subtext)
- [ ] **Apartment:** Can't look at specific newspaper clippings
- [ ] **Beach:** Can't look at the moon (atmosphere opportunity)

---

## Technical Issues with Story Files

1. **Dialogue ID collision:** `hotel_clerk_dialogue` in Act 1 references pattern that doesn't match Act 2 `grocery_dialogue` style.

2. **State tracking inconsistency:**
   - `talked_to_kat_bus` set in dialogue, checked in hotspot
   - But interpreter doesn't seem to track these flags between TALK and LOOK actions

3. **Scene transition clarity:**
   - `-> chase_begins` jumps from Act 2 to Act 3 mid-dialogue
   - Works narratively but file boundary is awkward

4. **Missing SCENE in Act 2:**
   - `hotel_lobby_evening` is defined but no transition TO it from day activities
   - How does player know evening has come?

---

## Final Recommendations

### Priority 1 (Blocker):
- [ ] Fix bus progression trigger (game-breaking)
- [ ] Fix Kat bus dialogue not firing
- [ ] Add "wait" or "continue" command for linear scenes

### Priority 2 (Important):
- [ ] Break up Zadok's exposition with player questions
- [ ] Add more bus content (longer journey = more dread)
- [ ] Implement window_looked counter for bus scene
- [ ] Add ambient descriptions in church congregation scene

### Priority 3 (Polish):
- [ ] Revise clunky dialogue lines noted above
- [ ] Add breathing room around THE LOOK moments
- [ ] Implement more hotspots for immersion
- [ ] Add inventory item descriptions

### Priority 4 (Enhancement):
- [ ] Consider alternate ending where Hermes follows Kat
- [ ] Add more Act 2 choice consequences
- [ ] Environmental storytelling in hotel room (water damage patterns that "almost look deliberate")

---

## Verdict

**The story is strong.** The emotional arc from curiosity → horror → loss → acceptance works. Kat's transformation from cold stranger to loved-and-lost is well-executed. THE LOOK moments land.

**The interpreter needs work.** Core progression mechanics (triggers, counters, conditional dialogue) aren't implemented, making the game unplayable past the bus scene.

**The pacing is mostly good** but Zadok's exposition could be broken up, and Act 3's church scene needs more room to breathe.

**The dialogue is 80% there.** A few lines need naturalization passes, but the important emotional beats are written well.

**Recommendation:** Fix the interpreter bugs first, then do a dialogue polish pass, then add missing hotspots for immersion.

---

*End of Playtest Report*
