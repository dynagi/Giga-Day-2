// Every user-facing line of text lives here.

export const copy = {
  gate: {
    // the very first words she sees (exact)
    hello: 'Hi Richa. Aaj thoda late ho gaya hai pata hai meko but thik hai chalo chalte hai aage fir.',
    line: 'tap anywhere to begin ✨',
    aria: 'Tap anywhere to begin',
  },

  /** The garden sequence: the very first thing after the tap. Exact wording. */
  garden: {
    remember: 'Remember the garden I made for you yesterday, the flowers in the garden wants to say something to you,',
    /** Two stanzas, line by line. */
    poem: [
      [
        'Oh, lovely girl, where have you come from?',
        'Even the spring seems to have bloomed within you.',
        'We flowers have spent our lives chasing beauty,',
        'yet one glance at you, and we forget our own.',
      ],
      [
        'The breeze slows just to watch you pass,',
        'the butterflies forget where they belong,',
        'and the moon whispers to the garden—',
        '\u2018Tonight, I am not the most beautiful thing in the sky.\u2019 🌷',
      ],
    ],
    says: 'Garden want to say something to you',
    see: 'See what you do with us',
    touchHint: 'touch the garden ✨',
    petalHint: 'psst… catch a petal 🌸',
    label: 'A lavender meadow slowly growing and blooming',
  },

  /** Playful message right after the garden, before the cosmic opening. Exact wording. */
  playfulHint: 'rub the fog away ✨',
  playful: [
    'Teko pata hai kya Richaaaaa.........',
    'I was going to send you something cute',
    'Then I remembered you have a mirror',
  ],

  thoughts: [
    'Not everything extraordinary needs to be loud.',
    'Some things just exist in their own way.',
    'Bilkul tumhari tarah. 💜',
    // English alternative for line 3:
    // "And somehow, that's what makes them special.",
  ],

  identity: {
    label: 'COSMIC · 23 NOVEMBER',
    title: 'A LITTLE MORE WONDER',
    subtitle: "Today's journey is going to be a little different.",
  },

  light: {
    hint: 'psst… follow the light ✨',
    srIntro: 'A small light is drifting across the sky. Tap it, or press Enter, to catch it.',
    srCaught: 'You caught the light.',
  },

  /** The personal poem scene, after the light is caught. */
  poem: {
    intro: ['Kal tumne video bheji thi yaad hai?', 'Toh mujhe kuch kehna tha tumse...'],
    /** Five couplets, in order. */
    couplets: [
      ['Tum woh chaand ho, jis par koi daag nahi,', 'Tum itni khoobsurat ho, jiska koi hisaab nahi.'],
      ['Tum woh nadi ho, jo apni marzi se behti hai,', 'Tum woh baag ho, jismein titliyan rehti hain.'],
      ['Tum woh phool ho, jo kabhi murjhata nahi,', 'Tum woh rang ho, jo kabhi utarta nahi.'],
      ['Tum woh nadi ho, jismein chaand nahata hai,', 'Tum woh haseen ho, jisse chaand bhi sharmata hai.'],
      ['Tum woh sooraj ho, jo thandak pahunchata hai,', 'Tum woh raasta ho, jo jannat tak jaata hai...'],
    ],
    heartLabel: 'A glowing lavender heart',
  },

  /** After the heart: asking permission for a few more words. Exact wording. */
  ask: {
    request: 'Agar mohtara ki ijjajat ho to kuch lafaj aur kehna chaenge hum',
    yes: 'Ijjajate hai',
    enough: 'Bas bhi kariye aur kitna hai',
    // only if she picks "enough"
    tease: 'abb tum ho hi itni sundar to meri kya galati ye aur sunn lo please',
    okay: 'Accha thik hai',
    // the poem's preamble
    simple: 'In simple words I say,',
    compliment: '"Acchi lag rahi ho"',
    fromHeart: 'But jab mai dil se bolu to,',
    /** Four pairs, line breaks exactly as written. */
    poem: [
      ['Arey tum khoobsurat jaise', 'chaand lagti ho,'],
      ['Tum nadan par pyari be-hisaab', 'lagti hoo,'],
      ["'Yeh kaanch ka tukda kya batayega", 'tumhe tumhari khubsurati,'],
      ['Zara meri aankhon se poochho tum', 'kitni la-jawaab lagti ho." 💕'],
    ],
  },

  /** Small hints for the interactive moments (each disappears once she does it). */
  hints: {
    gather: 'hold to gather the stars ✨',
    swipe: 'swipe across the title ✨',
    heart: 'hold the heart 💜',
    nextLine: 'tap for the next line ✨',
  },

  /** Little space friends who float in at the start of the cosmic opening. */
  friends: {
    hi: ['hi Richa! 👋', 'hiii Richaaa 💜', 'hello Richa ✨', 'hi hi hi Richa!'],
    // when she taps one
    boop: ['hehe 💜', 'yay!! ✨', 'boop! 🌸', 'again again!'],
  },

  /** Part 1–2 of the journey: the phone conversation and the hostel. Exact wording. */
  story: {
    contact: 'Parth',
    phoneTime: '10:47 PM',
    chatDay: 'Today',
    chat: [
      { from: 'them', text: 'Kya kar rahe ho' },
      { from: 'me', text: 'kuch nahi asman mai kuch dekh raha tha' },
      { from: 'them', text: 'kya dekh rahe ho' },
      { from: 'me', text: 'waha upar koi tumhe yaad kar raha hai wo tumse kuch kahna chahata hai tumse' },
      { from: 'them', text: 'kya bolna chahta hai' },
      { from: 'me', text: 'tum khud hi puch lo, taiyaar hoo jao mai aa raha hu' },
    ],
    hostelSign: 'HOSTEL',
    // at her hostel: her question, and his answer (exact)
    richaAsks: 'Kon meko yaad kar raha hai?',
    gigaSays: 'Chalo tumhe hi le chalta hu uske pass.',
    you: 'Giga',
    lookHint: 'drag to look around 👀',
    phoneHint: 'tap to check your phone 📱',
    readHint: 'tap to continue',
    label: "Through Giga's eyes: down from the stars to a city at night, a message on his phone, then the walk to Richa's hostel",
  },

  /** Part 3–4: leaving Earth, the 360° look around it, the Moon. The Moon line is exact. */
  journey: {
    earthLabel: 'Leaving Earth, looking around the planet, then arriving at the Moon',
    moonLine: 'Aaj to chand bhi tumhe dekh ke sharma raha haike aaj chaand khud ko kaam chamakdaar samajh raha, hai tum itna saj ke aayi ho',
    dragHint: 'drag to look around 🌍',
    moonHint: 'tap the moon 🌙',
    // what the shy Moon says when she taps it
    moonBlush: ['sharma gaya 🙈', 'hehe… 💗', 'ab bas bhi karo 🌙'],
    credit: 'Planet textures: Solar System Scope (CC BY 4.0)',
    // the planets welcome her as she leaves Earth (Saturn stays a surprise for later)
    welcome: [
      { id: 'mercury', name: 'Mercury', line: 'Sabse pehle main! Hi Richa 👋' },
      { id: 'venus', name: 'Venus', line: 'Itni chamak? Pakka Richa aayi hai ✨' },
      { id: 'mars', name: 'Mars', line: 'Main toh pehle se laal hoon… warna sharma ke ho jaata 😅' },
      { id: 'jupiter', name: 'Jupiter', line: 'Sabse bada grah, sabse bada hug — tumhare liye 🤗' },
      { id: 'uranus', name: 'Uranus', line: 'Tumhe dekh ke main toh side mein hi let gaya 🙃' },
      { id: 'neptune', name: 'Neptune', line: 'Itni door se aaya hoon, sirf tumhe welcome bolne 💙' },
    ],
    psst: 'psst… koi aur bhi tumhara intezaar kar raha hai ✨',
  },

  /** Part 5–6: the voyage to Saturn and the arrival. Exact wording for the title and the light's line. */
  voyage: {
    label: 'The journey from the Moon to Saturn',
    // after the Moon, before the travel begins (exact)
    prelude: 'Abb tumhe uske pass le chalta hu jo tumhe yaad kar raha tha',
    date: '23 NOVEMBER',
    title: 'DESTINATION: SATURN',
    boostHint: 'hold to go faster ✨',
    dragHint: 'drag to look around Saturn 🪐',
  },

  /**
   * Saturn, the narrator: four chapters, its final thought, and the secret (Enceladus).
   * Every line is exact (SATURN_SPEC.md), with its emojis and line breaks: one array entry per line,
   * one inner array per stanza.
   */
  saturn: {
    label: 'Saturn talks to Richa: four chapters, a final thought, and a secret',
    skip: 'Skip chapter ›',
    tapHint: 'tap for the next line',
    factsButton: 'Saturn facts',
    factsTitle: 'Saturn',
    close: 'Close',
    facts: [
      { icon: '🪐', label: 'Where it lives', value: '6th planet · ≈ 1.4 billion km from the Sun', note: "about 9.5× Earth's distance" },
      { icon: '⏳', label: 'One year there', value: '≈ 29.5 Earth years', note: '' },
      { icon: '⚡', label: 'One day there', value: '≈ 10.5 hours', note: 'second-fastest spin after Jupiter' },
      { icon: '🛁', label: 'Density', value: 'Lighter than water', note: 'on average less dense than water' },
      { icon: '🌙', label: 'Moons', value: '270+ known', note: 'more than any other planet' },
    ],
    hotspots: {
      rings: {
        title: 'The Rings',
        points: [
          'The main rings stretch about 270,000 km across, but most of them are only about 10 m to 1 km thick.',
          'They are mostly water ice, in pieces from dust grains up to house-sized chunks.',
          'Roughly every 15 years they line up edge-on with Earth and almost vanish from view. The last time was 2025.',
        ],
      },
      hexagon: {
        title: 'The Hexagon',
        points: [
          "A six-sided jet stream circles Saturn's north pole. Each side is longer than Earth is wide.",
          'Voyager first saw it in 1981, and Cassini watched it for years.',
        ],
      },
      titan: {
        title: 'Titan',
        points: [
          'Titan is bigger than the planet Mercury and has a thick nitrogen atmosphere.',
          'It is the only place besides Earth known to have stable surface liquid: lakes and seas of liquid methane and ethane.',
        ],
      },
      // only after the reveal
      enceladus: {
        title: 'Enceladus',
        points: [
          'Enceladus is about 500 km across.',
          'It reflects almost all the sunlight that hits it, making it one of the brightest objects in the Solar System.',
          "Jets of water vapour and ice spray from its south pole. They feed Saturn's E ring, and they come from an ocean hidden under its icy crust.",
        ],
      },
    },
    chapters: [
      {
        id: 'rings',
        num: 'CHAPTER 01',
        title: 'RINGS HAIN, PAR KAAM KHATAM NAHI HOTA',
        inspired: "Inspired by Saturn's rings",
        stanzas: [
          ['Mere paas rings hain…', 'aur madam, tumhare paas pending kaam.'],
          ['Difference bas itna hai,', 'meri rings toh space mein ghoomti hain…', 'aur tumhare assignments mere dimaag mein. 😭'],
        ],
        soft: 'Rings ke beech bhi gap hota hai, madam. Usko break bolte hain. Kabhi try karna. 💜',
      },
      {
        id: 'shani',
        num: 'CHAPTER 02',
        title: 'SHANI KI NAZAR',
        inspired: 'Inspired by Saturn being "Shani", and Saturday being named after Saturn',
        stanzas: [
          ['Log kehte hain Shani ki nazar se bacho… 🪐', 'Saturday ka naam bhi mere naam pe rakha hai, isliye sab mujhse darte hain.'],
          ['Par sach bataun, Richa?', 'Yahan toh Shani khud tumse bach raha hai. 😭'],
          ['Main saade saati laata hoon, log saade saat saal darte hain…', 'tum ek "hmm" bhejti ho,', 'aur saamne wala poori raat sochta rehta hai ki galti kya ki. 😂'],
        ],
        soft: 'Waise Shani ka kaam hai sabak sikhana… tum bhi sikhati ho, bas thoda pyaar se. 💜',
      },
      {
        id: 'moons',
        num: 'CHAPTER 03',
        title: '270 CHAAND, PAR EK BHI SHAANTI NAHI',
        inspired: "Inspired by Saturn's moons",
        stanzas: [
          ['Mere paas chaand hi chaand hain…', 'ab tak ginne jaao toh 270 se zyada ho chuke hain. 🌙'],
          ['Lekin tumhare paas topics kitne hain, Richa?', 'Ek baat shuru karti ho…', 'phir doosri, teesri, chauthi…', 'aur main beech mein apna original topic hi bhool jaata hoon. 😭'],
          ['Mere chaand toh mere chakkar kaat ke wapas aa jaate hain…', 'tumhari baatein toh pata nahi kahaan-kahaan ghoom ke aati hain.'],
        ],
        soft: 'Bolti raho… space itni khaali hai, tumhari awaaz se thodi bhar jaayegi. ✨',
      },
      {
        id: 'gravity',
        num: 'CHAPTER 04',
        title: 'GRAVITY MERI, DISTRACTION TUMHARI',
        inspired: "Inspired by Saturn's gravitational pull",
        stanzas: [
          ['Meri gravity itni powerful hai…', 'ki main apne aas-paas ki cheezon ko kheench leta hoon.'],
          ['Lekin tumhara talent alag hai, Richa.', 'Tum bina gravity ke hi sabka dhyaan kheench leti ho. 😭'],
          ['Koi kaam karne baithta hai…', 'tumhari ek baat sunta hai…', 'aur phir kaam gaya bhaad mein.'],
          ['Kisi ka naam nahi lunga… par Giga, main tumhe dekh raha hoon. 😂'],
        ],
        soft: 'Kuch cheezein gravity se kheenchti hain… aur kuch bas tumhari tarah hoti hain. 💜',
      },
    ],
    final: [
      ['Main bada hoon, mere rings hain, mere chaand hain, mere storms hain…', 'par tum bhi kuch kam nahi ho, Richa. 😌'],
      ['Tumhare paas pending kaam hain,', 'endless topics hain,', 'ek "hmm" hai jo sabko dara de,', 'aur ek aisi gravity hai jo kisi ka bhi kaam chhudwa de. 😂'],
      ['Toh ab batao…', 'ye planet ka description tha ya tumhara? 💜'],
    ],
    secret: [
      ['Ek secret bataun?', 'Wo chhoti si roshni yaad hai, jo tumse do baar bhaagi thi?'],
      ['Wo mera chaand hai… Enceladus.', 'Chhota sa, bas ~500 km ka,', 'par poore Solar System ki sabse chamakdaar cheezon mein se ek.'],
      ['Aur ye space mein paani ke fountains udaata rehta hai… sabko free mein. 💧', 'Kisi ki yaad aa rahi hai? 😂'],
    ],
    secretLast: 'Isi ne tumhe yahan tak laaya tha. ✨',
    complete: {
      title: 'One planet. Full chaos.',
      quote: 'Saturn ke paas rings hain. Humare paas Richa hai. Mukabla barabar hai. 😌',
      badge: 'Day 2 complete · Saturn & Enceladus discovered ♡',
    },
  },

  continued: 'to be continued… ✨',

  sound: {
    mute: 'Mute music',
    play: 'Play music',
  },
} as const;
