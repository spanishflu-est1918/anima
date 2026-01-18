# ============================================================================
# SHADOW OVER INNSMOUTH - ACT 2: INVESTIGATION
# ============================================================================

GAME
  title: "Shadow over Innsmouth"
  act: 2
  author: "Hermes & Gorka"
END

# ============================================================================
# SCENE 5: HOTEL ROOM - MORNING
# ============================================================================

SCENE hotel_room
  location: "Room 7, Gilman House"
  time: morning
  mood: uneasy

  DESCRIPTION
    A cramped room that smells of salt and mildew.
    The wallpaper peels in long strips.
    Water stains on the ceiling form patterns that almost look deliberate.
    Through the grimy window: fog, and the distant harbor.
  END

  ON_ENTER
    "You didn't sleep well."
    "Dreams of water. Of something calling from below."
    hermes (thinks): "Just a dream."
    hermes (thinks): "Today I find answers."
  END

  HOTSPOT window [50, 150, 100, 120]
    name: "Window"
    LOOK
      "The fog is thinner now. You can see the town."
      "Crumbling buildings. Empty streets."
      "The harbor is busy though. Fishing boats."
      hermes (thinks): "They fish at night. Sleep during the day."
      hermes (thinks): "Nocturnal fishermen. That's... unusual."
    END
  END

  HOTSPOT bed [200, 300, 150, 100]
    name: "Bed"
    LOOK
      "The sheets are damp. They were damp when you got in."
      "You slept on top of the covers."
    END
  END

  HOTSPOT door [400, 200, 60, 150]
    name: "Door"
    LOOK
      "The lock is flimsy. A chair is wedged under the handle."
      "You put it there last night."
      "You don't remember why."
    END
    USE
      "Time to explore this town."
      -> town_square
    END
  END

  HOTSPOT notebook [300, 350, 40, 30]
    name: "Your Notebook"
    LOOK
      "Your research notes."
      "Innsmouth: founded 1643. Population decline after 1846."
      "The Esoteric Order of Dagon — local religious group."
      "Captain Obed Marsh — brought 'prosperity' from the South Seas."
      hermes (thinks): "Everyone I asked about this place got nervous."
      hermes (thinks): "Now I know why."
    END
    USE
      GIVE notebook
      "You pocket the notebook."
    END
  END
END

# ============================================================================
# SCENE 6: TOWN SQUARE
# ============================================================================

SCENE town_square
  location: "Innsmouth Town Square"
  time: morning
  mood: desolate

  DESCRIPTION
    The heart of Innsmouth.
    A dried-up fountain. Boarded storefronts.
    The few people on the street don't look at you.
    They don't look at anything directly.
  END

  ON_ENTER
    IF NOT visited_square
      "The town is worse in daylight."
      "Half the buildings are abandoned. The rest should be."
      "A church dominates the north side. The fish symbol again."
      SET visited_square = true
    END
  END

  HOTSPOT church [300, 50, 120, 150]
    name: "Church of Dagon"
    LOOK
      "The Esoteric Order of Dagon."
      "The doors are closed. Chained, actually."
      "But you can hear something inside. Chanting?"
      hermes (thinks): "Services are at night. Of course they are."
    END
    USE
      "The chains are thick. You're not getting in this way."
      IF HAS(notebook)
        hermes (thinks): "There might be another entrance."
      END
    END
  END

  HOTSPOT grocery [100, 200, 100, 100]
    name: "Grocery Store"
    LOOK
      "One of the few businesses still open."
      "The sign says 'MARSH GROCERY'."
      "Everything in this town is named Marsh."
    END
    USE
      -> grocery_store
    END
  END

  HOTSPOT locals [450, 250, 80, 100]
    name: "Locals"
    LOOK
      "A group of townspeople."
      "They're watching you. Pretending not to."
      "Their features are... off. Wide mouths. Bulging eyes."
      hermes (thinks): "Inbreeding. Small town. That's all it is."
    END
    TALK
      "You approach them."
      "They disperse before you get close."
      "One of them spits on the ground where you were about to step."
    END
  END

  HOTSPOT kat_figure [500, 300, 60, 100]
    name: "Figure in the Distance"
    condition: NOT talked_to_kat_square
    LOOK
      "Someone standing by the old library."
      "Dark hair. Leather jacket."
      hermes (thinks): "The woman from the bus."
    END
    TALK
      -> kat_square_dialogue
    END
  END

  HOTSPOT harbor_road [600, 200, 50, 150]
    name: "Road to Harbor"
    LOOK
      "A road leading down to the waterfront."
      "The smell of fish is stronger from there."
    END
    USE
      -> harbor
    END
  END

  HOTSPOT hotel_direction [50, 200, 50, 150]
    name: "Back to Hotel"
    USE
      -> hotel_lobby
    END
  END
END

# ============================================================================
# SCENE 7: GROCERY STORE
# ============================================================================

SCENE grocery_store
  location: "Marsh Grocery"
  time: morning
  mood: tense

  DESCRIPTION
    Dusty shelves. Mostly canned goods.
    The proprietor watches you from behind the counter.
    He has the Innsmouth look. Worse than most.
  END

  ON_ENTER
    "A bell jingles as you enter."
    "The man behind the counter doesn't greet you."
    "He just... watches."
  END

  HOTSPOT proprietor [300, 200, 100, 150]
    name: "Proprietor"
    LOOK
      "He's old. Very old."
      "His neck has ridges. Like gills."
      hermes (thinks): "Skin condition. Has to be."
    END
    TALK
      -> grocery_dialogue
    END
  END

  HOTSPOT shelves [100, 150, 150, 200]
    name: "Shelves"
    LOOK
      "Canned fish. Dried fish. Salted fish."
      "Nothing fresh. Nothing that isn't fish."
      "Except..."
      IF NOT HAS(old_newspaper)
        "There's an old newspaper tucked behind some cans."
      END
    END
    USE
      IF NOT HAS(old_newspaper)
        "You pull out the newspaper."
        "It's from 1927. Headline: 'FEDERAL RAID ON INNSMOUTH'"
        hermes (thinks): "A raid? What did they find?"
        GIVE old_newspaper
      ELSE
        "Just fish."
      END
    END
  END

  HOTSPOT door [50, 200, 50, 150]
    name: "Exit"
    USE
      -> town_square
    END
  END
END

DIALOGUE grocery_dialogue
  proprietor: "..."
  
  CHOICE
    > "I'm researching the history of Innsmouth."
      proprietor: "No history here."
      hermes: "The federal raid in 1927—"
      proprietor: "Get out."
      hermes: "I just want to—"
      proprietor: "GET OUT."
      SET grocery_hostile = true
      -> town_square
    > "Do you know the Marsh family?"
      proprietor: "Everyone's Marsh here."
      hermes: "I mean the original family. Captain Obed—"
      "He reaches under the counter."
      hermes (thinks): "Time to go."
      -> town_square
    > "Never mind."
      -> town_square
  END
END

# ============================================================================
# SCENE 8: HARBOR
# ============================================================================

SCENE harbor
  location: "Innsmouth Harbor"
  time: morning
  mood: ominous

  DESCRIPTION
    Rotting piers. Fishing boats in various states of decay.
    The smell is overwhelming. Not just fish.
    Something else. Something wrong.
    Offshore, through the fog: Devil Reef.
  END

  ON_ENTER
    IF NOT visited_harbor
      "The harbor is busy despite the town being dead."
      "Fishermen work on their boats. They don't look up."
      "They're all... wrong. More wrong than the others."
      hermes (thinks): "The ones who work the water are the worst."
      SET visited_harbor = true
    END
  END

  HOTSPOT devil_reef [400, 50, 150, 100]
    name: "Devil Reef"
    LOOK
      "A rocky outcrop about a mile offshore."
      "Something's on it. Buildings?"
      "No. That can't be right."
      hermes (thinks): "The stories say that's where they come from."
      hermes (thinks): "Where WHAT comes from?"
    END
  END

  HOTSPOT old_drunk [150, 300, 80, 100]
    name: "Old Man"
    condition: NOT talked_to_zadok
    LOOK
      "An old man sitting on a crate."
      "He's different from the others. More human."
      "He's drinking from a bottle."
    END
    TALK
      -> zadok_dialogue
    END
  END

  HOTSPOT fishing_boats [300, 250, 150, 100]
    name: "Fishing Boats"
    LOOK
      "The boats go out at night. Come back at dawn."
      "Their nets are full but..."
      hermes (thinks): "That's not fish."
      "One of the fishermen notices you looking."
      "You look away."
    END
  END

  HOTSPOT town_direction [50, 200, 50, 150]
    name: "Back to Town"
    USE
      -> town_square
    END
  END
END

# ============================================================================
# ZADOK ALLEN - THE DRUNK WHO KNOWS
# ============================================================================

DIALOGUE zadok_dialogue
  "The old man looks up at you."
  "His eyes are clear. Afraid."
  
  zadok: "You're not from here."
  hermes: "No. I'm researching—"
  zadok: "Don't say it out loud."
  
  "He looks around. Terrified."
  
  zadok: "Buy me a drink. Down by the old pier. Sunset."
  zadok: "I'll tell you everything."
  zadok: "Then you run. You hear me? You RUN."
  
  SET zadok_meeting = true
  SET talked_to_zadok = true
  
  hermes (thinks): "Finally. Someone who'll talk."
  hermes (thinks): "But why is he so scared?"
  -> END
END

# ============================================================================
# KAT IN THE SQUARE
# ============================================================================

DIALOGUE kat_square_dialogue
  "You catch up to her by the old library."
  
  kat: "Following me?"
  hermes: "I... no. Well. Maybe."
  
  "She almost smiles. Almost."
  
  kat: "The library's been closed for twenty years."
  hermes: "I noticed."
  kat: "But there's a way in. Around back."
  hermes: "Why are you telling me this?"
  
  "She looks at you. Really looks."
  "For a moment, something passes between you."
  
  kat: "Because you're looking for the same thing I am."
  hermes: "Which is?"
  kat: "The truth about this place."
  
  "She walks away."
  
  kat: "The back window. It's unlocked."
  
  SET talked_to_kat_square = true
  SET knows_library_entrance = true
  
  hermes (thinks): "Who is she?"
  hermes (thinks): "And why do I trust her?"
  -> END
END

# ============================================================================
# SCENE 9: OLD LIBRARY
# ============================================================================

SCENE library
  location: "Innsmouth Public Library"
  time: afternoon
  mood: dusty_secrets

  DESCRIPTION
    Abandoned for decades. Dust everywhere.
    Most books are gone. Or destroyed.
    But some remain. Hidden in the back.
  END

  ON_ENTER
    IF NOT visited_library
      "You climbed through the back window."
      "The library is a tomb of knowledge."
      "Whatever they didn't want people to read is still here."
      SET visited_library = true
    END
  END

  HOTSPOT history_section [150, 150, 100, 150]
    name: "Local History Section"
    LOOK
      "Most shelves are empty."
      "But there's a book hidden behind others."
      "'The Marsh Family: A History'"
      IF NOT HAS(marsh_book)
        hermes (thinks): "This could be useful."
      END
    END
    USE
      IF NOT HAS(marsh_book)
        "You take the book."
        GIVE marsh_book
        "It details Captain Obed Marsh's 'trade' with the South Seas."
        hermes (thinks): "He didn't bring back gold. He brought back... something else."
      ELSE
        "Empty shelves."
      END
    END
  END

  HOTSPOT newspaper_archive [350, 200, 120, 100]
    name: "Newspaper Archive"
    LOOK
      "Stacks of old Innsmouth Couriers."
      "The dates stop in 1928."
      "The year after the federal raid."
    END
    USE
      "You flip through the papers."
      "Headlines about missing persons. Strange lights over Devil Reef."
      "Then: 'GOVERNMENT COVER-UP?' — the last issue."
      hermes (thinks): "They knew. And they were silenced."
      SET read_newspapers = true
    END
  END

  HOTSPOT kat_library [450, 250, 80, 120]
    name: "Kat"
    condition: talked_to_kat_square AND NOT talked_kat_library
    LOOK
      "She's here. Reading something."
      "Her face is pale."
    END
    TALK
      -> kat_library_dialogue
    END
  END

  HOTSPOT window [50, 200, 50, 150]
    name: "Window"
    USE
      -> town_square
    END
  END
END

DIALOGUE kat_library_dialogue
  "She doesn't look up when you approach."
  
  kat: "I found my grandmother's name."
  hermes: "In the town records?"
  
  "She hands you a ledger. Handwritten."
  "Names. Dates. Pairings."
  "Like a stud book for horses."
  
  kat: "They kept track of who had children with who."
  kat: "My grandmother. She's in here. 1904."
  kat: "She got out. Changed her name."
  kat: "My mother never talked about it."
  
  hermes: "Kat..."
  
  kat: "My real name is Katherine. Katherine Marsh."
  
  "She finally looks at you."
  "Her eyes are wet. And something else."
  "A flicker of something gold in her irises."
  
  kat: "I came here to find my family."
  kat: "I think I found more than that."
  
  SET talked_kat_library = true
  SET knows_kat_marsh = true
  
  hermes (thinks): "She's one of them."
  hermes (thinks): "But she didn't know."
  hermes (thinks): "Does it matter?"
  -> END
END

# ============================================================================
# SCENE 10: HOTEL LOBBY - EVENING
# ============================================================================

SCENE hotel_lobby_evening
  location: "Gilman House Hotel"
  time: evening
  mood: paranoid

  DESCRIPTION
    The lobby is darker now.
    The clerk is gone.
    Something is different. Wrong.
    You can hear movement upstairs. Multiple footsteps.
  END

  ON_ENTER
    IF zadok_meeting
      hermes (thinks): "Zadok. Sunset. The old pier."
      hermes (thinks): "But something's wrong here."
    END
    IF NOT noticed_followers
      "You notice them now."
      "Shapes in doorways. Watching."
      "You've been followed all day."
      SET noticed_followers = true
    END
  END

  HOTSPOT stairs [400, 150, 80, 150]
    name: "Stairs"
    LOOK
      "You can hear them up there."
      "In the hallway. Outside your room."
      hermes (thinks): "Don't go up there."
    END
    USE
      "Not yet. You need to meet Zadok first."
      "Then you need to run."
    END
  END

  HOTSPOT front_door [200, 200, 80, 150]
    name: "Front Door"
    LOOK
      "Sunset. The meeting with Zadok."
      "It might be your only chance."
    END
    USE
      IF zadok_meeting
        -> pier_meeting
      ELSE
        -> town_square
      END
    END
  END
END

# ============================================================================
# SCENE 11: THE PIER - ZADOK'S REVELATION
# ============================================================================

SCENE pier_meeting
  location: "Old Pier"
  time: sunset
  mood: revelation

  DESCRIPTION
    The sun bleeds into the ocean.
    Zadok is waiting. Drunk. Terrified.
    He starts talking before you even sit down.
  END

  ON_ENTER
    -> zadok_revelation
  END
END

DIALOGUE zadok_revelation
  zadok: "Obed Marsh. 1838. He sailed to the South Seas."
  zadok: "Found an island. Traded with them."
  
  hermes: "Traded with who?"
  
  zadok: "The Deep Ones."
  
  "He drinks. His hands are shaking."
  
  CHOICE
    > "What are the Deep Ones?"
      zadok: "They live under the water. They don't die."
      zadok: "Fish-men. Or man-fish. Don't matter."
      zadok: "They been there longer than us. Longer than anything."
      -> zadok_part2
    > "What kind of trade?"
      zadok: "Gold. Fish. More than any nets could catch."
      zadok: "In exchange for..."
      "He can't say it."
      -> zadok_part2
  END
END

DIALOGUE zadok_part2
  zadok: "Breeding. They wanted to breed with us."
  
  hermes: "That's insane."
  
  zadok: "Is it? You seen the people here."
  zadok: "The Marsh family first. Then others."
  zadok: "Children look normal at first. Then they change."
  
  hermes: "The Innsmouth look."
  
  zadok: "Now you're getting it."
  
  CHOICE
    > "What happens when they change completely?"
      zadok: "They go to the water. Devil Reef."
      zadok: "That's where they live now. Thousands of 'em."
      -> zadok_part3
    > "And Dagon? The church?"
      zadok: "Father Dagon. Mother Hydra."
      zadok: "They're the old ones. Big as houses."
      zadok: "The church worships them. Has for a hundred years."
      -> zadok_part3
  END
END

DIALOGUE zadok_part3
  "He grabs your arm. His grip is iron."
  
  zadok: "The Marsh girl. The one you've been talking to."
  
  hermes: "Kat?"
  
  zadok: "She's got the blood. Strong blood."
  zadok: "They'll come for her tonight."
  zadok: "And for you, because you know."
  
  "He stands. Stumbles."
  
  zadok: "Run. Both of you. NOW."
  
  "A sound. Splashing. From the water."
  
  zadok: "They're here. Oh god. They're HERE."
  
  SET zadok_told_truth = true
  SET knows_deep_ones = true
  
  "Shapes rise from the harbor."
  "Not human. Not anymore."
  
  -> chase_begins
END

# ============================================================================
# END OF ACT 2
# ============================================================================

ACT_END
  summary: "Hermes learns the truth. The Deep Ones are real. And they're coming."
  next: act3.story
  
  STATE_CHECK
    REQUIRE knows_deep_ones = true
    REQUIRE zadok_told_truth = true
    
    TRACK knows_kat_marsh
    TRACK talked_kat_library
    TRACK HAS(marsh_book)
    TRACK HAS(old_newspaper)
  END
END
