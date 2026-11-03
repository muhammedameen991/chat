import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '..', 'public', 'avatars');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Color palette constants
const C = {
  gold: '#FFCB3D',
  goldLight: '#FFE382',
  goldDark: '#E5A812',
  softGreen: '#5D9253',
  deepGreen: '#557945',
  forestGreen: '#3A532E',
  pineGreen: '#23381B',
  orange: '#F1A344',
  amberDark: '#C87217',
  cream: '#FFF9ED',
  darkText: '#263126',
  sage: '#8FA885',
  terracotta: '#D9734E',
  skyBlue: '#6BA4B8',
};

const avatars = [
  // DEFAULT
  {
    filename: 'default_avatar.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.deepGreen}"/>
      <stop offset="100%" stop-color="${C.forestGreen}"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.goldLight}"/>
      <stop offset="100%" stop-color="${C.gold}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#bg)"/>
  <circle cx="80" cy="56" r="28" fill="url(#sun)"/>
  <path d="M80 50 C65 65 65 95 80 108 C95 95 95 65 80 50 Z" fill="${C.softGreen}"/>
  <path d="M80 50 L80 108" stroke="${C.goldLight}" stroke-width="2" stroke-linecap="round"/>
  <path d="M38 138 C44 116 60 106 80 106 C100 106 116 116 122 138 Z" fill="rgba(255,249,237,0.2)"/>
</svg>`,
  },

  // 1. NATURE
  {
    filename: 'nature_grove_oak.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8F4E3"/>
      <stop offset="100%" stop-color="${C.cream}"/>
    </linearGradient>
    <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#5C4033"/>
      <stop offset="100%" stop-color="#7B563D"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#bg1)"/>
  <circle cx="80" cy="58" r="38" fill="${C.gold}" opacity="0.4"/>
  <rect x="74" y="80" width="12" height="48" rx="4" fill="url(#trunk)"/>
  <circle cx="80" cy="62" r="32" fill="${C.deepGreen}"/>
  <circle cx="62" cy="74" r="24" fill="${C.softGreen}"/>
  <circle cx="98" cy="74" r="24" fill="${C.softGreen}"/>
  <circle cx="80" cy="46" r="22" fill="${C.gold}"/>
  <path d="M80 32 C74 44 86 52 80 62" stroke="${C.cream}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`,
  },
  {
    filename: 'nature_sunlit_meadow.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF0C2"/>
      <stop offset="100%" stop-color="#FFE082"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#sky2)"/>
  <circle cx="110" cy="48" r="26" fill="${C.gold}" filter="drop-shadow(0 0 8px rgba(255,203,61,0.6))"/>
  <path d="M0 110 Q50 85 110 115 T160 110 L160 160 L0 160 Z" fill="${C.softGreen}"/>
  <path d="M0 125 Q70 105 160 130 L160 160 L0 160 Z" fill="${C.deepGreen}"/>
  <circle cx="45" cy="120" r="4" fill="${C.cream}"/>
  <circle cx="65" cy="132" r="3.5" fill="${C.gold}"/>
  <circle cx="120" cy="125" r="4" fill="${C.cream}"/>
</svg>`,
  },
  {
    filename: 'nature_emerald_forest.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="bg3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2D4624"/>
      <stop offset="100%" stop-color="${C.pineGreen}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#bg3)"/>
  <polygon points="80,24 54,68 106,68" fill="${C.softGreen}"/>
  <polygon points="80,48 46,98 114,98" fill="${C.deepGreen}"/>
  <polygon points="80,72 38,132 122,132" fill="${C.forestGreen}"/>
  <circle cx="80" cy="22" r="6" fill="${C.gold}"/>
  <line x1="80" y1="28" x2="80" y2="132" stroke="rgba(255,249,237,0.25)" stroke-width="2"/>
</svg>`,
  },
  {
    filename: 'nature_golden_peaks.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="peakSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.orange}"/>
      <stop offset="100%" stop-color="${C.gold}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#peakSky)"/>
  <circle cx="80" cy="65" r="32" fill="${C.cream}" opacity="0.9"/>
  <polygon points="80,50 30,140 130,140" fill="${C.forestGreen}"/>
  <polygon points="80,50 80,140 130,140" fill="${C.deepGreen}"/>
  <polygon points="80,50 64,80 80,75 96,80" fill="${C.cream}"/>
  <polygon points="120,80 90,140 150,140" fill="${C.softGreen}"/>
  <polygon points="40,88 10,140 70,140" fill="${C.pineGreen}"/>
</svg>`,
  },

  // 2. ABSTRACT
  {
    filename: 'abstract_solar_spiral.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="absBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.pineGreen}"/>
      <stop offset="100%" stop-color="${C.deepGreen}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#absBg)"/>
  <circle cx="80" cy="80" r="54" fill="none" stroke="${C.gold}" stroke-width="4" stroke-dasharray="14 8"/>
  <circle cx="80" cy="80" r="40" fill="none" stroke="${C.orange}" stroke-width="5" stroke-dasharray="10 6"/>
  <circle cx="80" cy="80" r="26" fill="none" stroke="${C.goldLight}" stroke-width="6"/>
  <circle cx="80" cy="80" r="12" fill="${C.gold}"/>
</svg>`,
  },
  {
    filename: 'abstract_botanical_mesh.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.cream}"/>
  <ellipse cx="65" cy="70" rx="36" ry="50" transform="rotate(-30 65 70)" fill="${C.softGreen}" opacity="0.8"/>
  <ellipse cx="95" cy="70" rx="36" ry="50" transform="rotate(30 95 70)" fill="${C.gold}" opacity="0.75"/>
  <ellipse cx="80" cy="100" rx="42" ry="32" fill="${C.deepGreen}" opacity="0.85"/>
  <circle cx="80" cy="75" r="14" fill="${C.orange}"/>
</svg>`,
  },
  {
    filename: 'abstract_solar_burst.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.deepGreen}"/>
  <g transform="translate(80,80)">
    <g fill="${C.gold}">
      <polygon points="0,-60 12,-20 -12,-20"/>
      <polygon points="0,60 12,20 -12,20"/>
      <polygon points="-60,0 -20,12 -20,-12"/>
      <polygon points="60,0 20,12 20,-12"/>
    </g>
    <g fill="${C.orange}" transform="rotate(45)">
      <polygon points="0,-50 10,-18 -10,-18"/>
      <polygon points="0,50 10,18 -10,18"/>
      <polygon points="-50,0 -18,10 -18,-10"/>
      <polygon points="50,0 18,10 18,-10"/>
    </g>
    <circle cx="0" cy="0" r="22" fill="${C.goldLight}"/>
    <circle cx="0" cy="0" r="12" fill="${C.cream}"/>
  </g>
</svg>`,
  },
  {
    filename: 'abstract_harmony_flow.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="flow1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.gold}"/>
      <stop offset="100%" stop-color="${C.orange}"/>
    </linearGradient>
    <linearGradient id="flow2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.softGreen}"/>
      <stop offset="100%" stop-color="${C.deepGreen}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="#1E2A1B"/>
  <path d="M-10 60 C50 10 110 110 170 50 L170 110 C110 170 50 70 -10 120 Z" fill="url(#flow1)" opacity="0.85"/>
  <path d="M-10 100 C60 50 100 150 170 100 L170 160 L-10 160 Z" fill="url(#flow2)" opacity="0.9"/>
  <circle cx="120" cy="45" r="16" fill="${C.goldLight}"/>
</svg>`,
  },

  // 3. MINIMAL
  {
    filename: 'minimal_zen_leaf.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.cream}"/>
  <circle cx="80" cy="80" r="52" fill="#E6EFE4"/>
  <path d="M80 34 C52 58 52 102 80 126 C108 102 108 58 80 34 Z" fill="${C.deepGreen}"/>
  <line x1="80" y1="38" x2="80" y2="124" stroke="${C.gold}" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="80" y1="62" x2="68" y2="72" stroke="${C.gold}" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="80" y1="80" x2="92" y2="90" stroke="${C.gold}" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="80" y1="98" x2="70" y2="108" stroke="${C.gold}" stroke-width="1.8" stroke-linecap="round"/>
</svg>`,
  },
  {
    filename: 'minimal_solar_ring.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.deepGreen}"/>
  <circle cx="80" cy="80" r="48" fill="none" stroke="${C.gold}" stroke-width="8"/>
  <circle cx="80" cy="80" r="28" fill="${C.softGreen}"/>
  <circle cx="80" cy="80" r="14" fill="${C.cream}"/>
</svg>`,
  },
  {
    filename: 'minimal_acorn_crest.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="#F7F1E1"/>
  <path d="M54 70 C54 55 106 55 106 70 Z" fill="${C.amberDark}"/>
  <rect x="77" y="44" width="6" height="14" rx="3" fill="${C.amberDark}"/>
  <path d="M55 74 C55 108 80 122 80 122 C80 122 105 108 105 74 Z" fill="${C.gold}"/>
  <line x1="80" y1="74" x2="80" y2="114" stroke="${C.amberDark}" stroke-width="2" stroke-linecap="round"/>
</svg>`,
  },
  {
    filename: 'minimal_horizon_lines.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.pineGreen}"/>
  <circle cx="80" cy="65" r="28" fill="${C.gold}"/>
  <line x1="25" y1="85" x2="135" y2="85" stroke="${C.orange}" stroke-width="4" stroke-linecap="round"/>
  <line x1="35" y1="100" x2="125" y2="100" stroke="${C.softGreen}" stroke-width="4" stroke-linecap="round"/>
  <line x1="45" y1="115" x2="115" y2="115" stroke="${C.deepGreen}" stroke-width="4" stroke-linecap="round"/>
  <line x1="60" y1="130" x2="100" y2="130" stroke="${C.cream}" stroke-width="3" stroke-linecap="round"/>
</svg>`,
  },

  // 4. ANIMALS
  {
    filename: 'animal_forest_fox.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.deepGreen}"/>
  <polygon points="46,38 72,74 38,78" fill="${C.orange}"/>
  <polygon points="114,38 122,78 88,74" fill="${C.orange}"/>
  <polygon points="50,46 66,72 44,74" fill="${C.cream}"/>
  <polygon points="110,46 116,74 94,72" fill="${C.cream}"/>
  <polygon points="38,76 122,76 80,128" fill="${C.orange}"/>
  <polygon points="38,76 80,128 55,100" fill="${C.cream}"/>
  <polygon points="122,76 105,100 80,128" fill="${C.cream}"/>
  <polygon points="73,120 87,120 80,128" fill="${C.darkText}"/>
  <circle cx="62" cy="85" r="4" fill="${C.darkText}"/>
  <circle cx="98" cy="85" r="4" fill="${C.darkText}"/>
  <circle cx="80" cy="40" r="8" fill="${C.gold}"/>
</svg>`,
  },
  {
    filename: 'animal_woodland_deer.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="#E8E2D5"/>
  <path d="M50 45 Q40 25 30 20 Q45 28 55 35 M110 45 Q120 25 130 20 Q115 28 105 35" stroke="${C.amberDark}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="80" cy="85" rx="32" ry="42" fill="${C.deepGreen}"/>
  <ellipse cx="80" cy="95" rx="22" ry="24" fill="${C.cream}"/>
  <ellipse cx="80" cy="112" rx="8" ry="6" fill="${C.darkText}"/>
  <ellipse cx="64" cy="78" rx="4" ry="6" fill="${C.gold}"/>
  <ellipse cx="96" cy="78" rx="4" ry="6" fill="${C.gold}"/>
</svg>`,
  },
  {
    filename: 'animal_soaring_hawk.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="hawkBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E5F0DF"/>
      <stop offset="100%" stop-color="${C.gold}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#hawkBg)"/>
  <circle cx="80" cy="65" r="30" fill="${C.cream}" opacity="0.8"/>
  <path d="M80 60 C55 30 20 50 15 65 C40 68 65 72 80 88 C95 72 120 68 145 65 C140 50 105 30 80 60 Z" fill="${C.pineGreen}"/>
  <polygon points="80,84 74,106 86,106" fill="${C.goldDark}"/>
  <polygon points="80,92 70,126 90,126" fill="${C.forestGreen}"/>
</svg>`,
  },
  {
    filename: 'animal_pine_owl.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.pineGreen}"/>
  <ellipse cx="80" cy="90" rx="42" ry="48" fill="${C.forestGreen}"/>
  <circle cx="62" cy="78" r="18" fill="${C.cream}"/>
  <circle cx="98" cy="78" r="18" fill="${C.cream}"/>
  <circle cx="62" cy="78" r="10" fill="${C.gold}"/>
  <circle cx="98" cy="78" r="10" fill="${C.gold}"/>
  <circle cx="62" cy="78" r="5" fill="${C.darkText}"/>
  <circle cx="98" cy="78" r="5" fill="${C.darkText}"/>
  <polygon points="80,84 74,98 86,98" fill="${C.orange}"/>
  <polygon points="50,48 60,62 44,64" fill="${C.softGreen}"/>
  <polygon points="110,48 100,62 116,64" fill="${C.softGreen}"/>
</svg>`,
  },

  // 5. ILLUSTRATIONS
  {
    filename: 'illus_grove_wanderer.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.cream}"/>
  <circle cx="80" cy="80" r="54" fill="#E2EDE0"/>
  <ellipse cx="80" cy="78" rx="26" ry="28" fill="#F4D3B0"/>
  <path d="M48 62 C52 35 108 35 112 62 Z" fill="${C.deepGreen}"/>
  <rect x="42" y="60" width="76" height="8" rx="4" fill="${C.gold}"/>
  <circle cx="70" cy="78" r="3" fill="${C.darkText}"/>
  <circle cx="90" cy="78" r="3" fill="${C.darkText}"/>
  <path d="M74 90 Q80 96 86 90" stroke="${C.darkText}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M45 140 C52 115 65 106 80 106 C95 106 108 115 115 140 Z" fill="${C.orange}"/>
  <path d="M68 106 L80 120 L92 106 Z" fill="${C.goldLight}"/>
</svg>`,
  },
  {
    filename: 'illus_sun_botanist.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="${C.deepGreen}"/>
  <ellipse cx="80" cy="82" rx="26" ry="28" fill="#FCD9B8"/>
  <path d="M50 78 C48 50 112 50 110 78 C98 58 62 58 50 78 Z" fill="${C.gold}"/>
  <circle cx="68" cy="82" r="8" fill="none" stroke="${C.goldDark}" stroke-width="2.5"/>
  <circle cx="92" cy="82" r="8" fill="none" stroke="${C.goldDark}" stroke-width="2.5"/>
  <line x1="76" y1="82" x2="84" y2="82" stroke="${C.goldDark}" stroke-width="2"/>
  <circle cx="68" cy="82" r="3" fill="${C.darkText}"/>
  <circle cx="92" cy="82" r="3" fill="${C.darkText}"/>
  <path d="M74 98 Q80 104 86 98" stroke="${C.darkText}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M42 144 C50 120 62 112 80 112 C98 112 110 120 118 144 Z" fill="${C.softGreen}"/>
  <circle cx="80" cy="38" r="14" fill="${C.orange}"/>
</svg>`,
  },
  {
    filename: 'illus_leaf_guardian.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <rect width="160" height="160" rx="40" fill="#1C2819"/>
  <ellipse cx="80" cy="82" rx="26" ry="30" fill="#E5BFA0"/>
  <path d="M50 74 C44 40 116 40 110 74 Z" fill="${C.deepGreen}"/>
  <polygon points="80,38 72,55 88,55" fill="${C.gold}"/>
  <polygon points="65,46 60,60 72,58" fill="${C.gold}"/>
  <polygon points="95,46 100,60 88,58" fill="${C.gold}"/>
  <circle cx="69" cy="82" r="3" fill="${C.darkText}"/>
  <circle cx="91" cy="82" r="3" fill="${C.darkText}"/>
  <path d="M74 96 Q80 100 86 96" stroke="${C.darkText}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M42 144 C48 114 62 108 80 108 C98 108 112 114 118 144 Z" fill="${C.forestGreen}"/>
  <circle cx="80" cy="116" r="6" fill="${C.gold}"/>
</svg>`,
  },
  {
    filename: 'illus_meadow_dreamer.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="dreamSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE0B2"/>
      <stop offset="100%" stop-color="${C.cream}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#dreamSky)"/>
  <ellipse cx="80" cy="86" rx="26" ry="28" fill="#FAD1AF"/>
  <circle cx="80" cy="56" r="34" fill="${C.amberDark}"/>
  <ellipse cx="80" cy="84" rx="25" ry="26" fill="#FAD1AF"/>
  <circle cx="62" cy="58" r="6" fill="${C.gold}"/>
  <circle cx="74" cy="52" r="6" fill="${C.cream}"/>
  <circle cx="86" cy="52" r="6" fill="${C.gold}"/>
  <circle cx="98" cy="58" r="6" fill="${C.cream}"/>
  <path d="M66 84 Q70 80 74 84" stroke="${C.darkText}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M86 84 Q90 80 94 84" stroke="${C.darkText}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M75 96 Q80 100 85 96" stroke="${C.darkText}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M44 146 C52 120 64 112 80 112 C96 112 108 120 116 146 Z" fill="${C.softGreen}"/>
</svg>`,
  },

  // 6. GRADIENT PORTRAITS
  {
    filename: 'gradient_amber_aurora.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <radialGradient id="grad1" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FFF3B0"/>
      <stop offset="40%" stop-color="${C.gold}"/>
      <stop offset="75%" stop-color="${C.orange}"/>
      <stop offset="100%" stop-color="${C.amberDark}"/>
    </radialGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#grad1)"/>
  <circle cx="80" cy="65" r="30" fill="${C.cream}" opacity="0.3"/>
  <ellipse cx="80" cy="130" rx="55" ry="35" fill="${C.cream}" opacity="0.25"/>
</svg>`,
  },
  {
    filename: 'gradient_deep_canopy.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <radialGradient id="grad2" cx="70%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#A7E898"/>
      <stop offset="45%" stop-color="${C.softGreen}"/>
      <stop offset="80%" stop-color="${C.deepGreen}"/>
      <stop offset="100%" stop-color="${C.pineGreen}"/>
    </radialGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#grad2)"/>
  <circle cx="80" cy="65" r="30" fill="${C.gold}" opacity="0.25"/>
  <ellipse cx="80" cy="130" rx="55" ry="35" fill="${C.gold}" opacity="0.18"/>
</svg>`,
  },
  {
    filename: 'gradient_sunset_clay.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="grad3" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.gold}"/>
      <stop offset="40%" stop-color="${C.terracotta}"/>
      <stop offset="100%" stop-color="#6B2D1B"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#grad3)"/>
  <circle cx="80" cy="65" r="30" fill="${C.cream}" opacity="0.3"/>
  <ellipse cx="80" cy="130" rx="55" ry="35" fill="${C.cream}" opacity="0.2"/>
</svg>`,
  },
  {
    filename: 'gradient_sylvan_mist.svg',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="grad4" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.deepGreen}"/>
      <stop offset="50%" stop-color="${C.sage}"/>
      <stop offset="85%" stop-color="#D7E8D3"/>
      <stop offset="100%" stop-color="${C.goldLight}"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="40" fill="url(#grad4)"/>
  <circle cx="80" cy="65" r="30" fill="${C.cream}" opacity="0.4"/>
  <ellipse cx="80" cy="130" rx="55" ry="35" fill="${C.cream}" opacity="0.3"/>
</svg>`,
  },
];

for (const a of avatars) {
  const target = path.join(outDir, a.filename);
  fs.writeFileSync(target, a.svg.trim() + '\n', 'utf-8');
  console.log('Created avatar:', a.filename);
}

console.log(`Successfully generated ${avatars.length} Golden Grove avatars in ${outDir}`);
