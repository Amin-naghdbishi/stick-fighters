import {
  AccessoryType,
  CapeBackType,
  EffectType,
  FaceType,
  FighterCustomization,
  HairType,
  HeadwearType,
  OutfitType,
  ShoeType,
  SkinType,
} from '../types/game';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CosmeticItem<T extends string> {
  id: T;
  name: string;
  icon: string;
  rarity: Rarity;
  description: string;
}

export const PRESET_COLORS = [
  { name: 'Comic Red', hex: '#EF4444' },
  { name: 'Terracotta Coral', hex: '#FF5733' },
  { name: 'Sunny Orange', hex: '#F97316' },
  { name: 'Sun Gold', hex: '#FFD700' },
  { name: 'Emerald Green', hex: '#10B981' },
  { name: 'Mint Meadow', hex: '#A8E6CF' },
  { name: 'Sky Azure', hex: '#3498DB' },
  { name: 'Cobalt Blue', hex: '#2563EB' },
  { name: 'Lilac Purple', hex: '#9B59B6' },
  { name: 'Pastel Pink', hex: '#F472B6' },
  { name: 'Hot Crimson', hex: '#E11D48' },
  { name: 'Cyber Cyan', hex: '#06B6D4' },
  { name: 'Beige Cream', hex: '#FDE68A' },
  { name: 'Rich Brown', hex: '#8D6E63' },
  { name: 'Dark Slate', hex: '#334155' },
  { name: 'Midnight Black', hex: '#0F172A' },
  { name: 'Pure White', hex: '#FFFFFF' },
];

export const SKINS_CATALOG: CosmeticItem<SkinType>[] = [
  { id: 'classic', name: 'Classic Stickman', icon: '👤', rarity: 'common', description: 'Standard stickman body' },
  { id: 'light', name: 'Fair Tone', icon: '🖐️', rarity: 'common', description: 'Light skin tone' },
  { id: 'tan', name: 'Sun-Kissed Tan', icon: '☀️', rarity: 'common', description: 'Warm golden skin tone' },
  { id: 'dark', name: 'Deep Bronze', icon: '🏾', rarity: 'common', description: 'Rich bronze tone' },
  { id: 'shadow', name: 'Shadow Ninja Body', icon: '🥷', rarity: 'uncommon', description: 'Dark shadowy silhouette' },
  { id: 'alien', name: 'Galactic Green', icon: '👽', rarity: 'rare', description: 'Extraterrestrial neon skin' },
  { id: 'cyber', name: 'Cyber Android', icon: '🤖', rarity: 'rare', description: 'Synthetic metallic chassis' },
  { id: 'golden', name: 'Golden Champion', icon: '🏆', rarity: 'legendary', description: 'Shimmering metallic gold' },
  { id: 'neon', name: 'Neon Plasma', icon: '⚡', rarity: 'epic', description: 'Vibrant neon body' },
  { id: 'cartoon', name: 'Pastel Comic', icon: '🎨', rarity: 'uncommon', description: 'Bold comic ink outline' },
];

export const HAIR_CATALOG: CosmeticItem<HairType>[] = [
  { id: 'none', name: 'Bald / None', icon: '👨‍🦲', rarity: 'common', description: 'Clean smooth head' },
  { id: 'short', name: 'Short Crewcut', icon: '💇‍♂️', rarity: 'common', description: 'Neat short haircut' },
  { id: 'long', name: 'Flowing Long Hair', icon: '🦱', rarity: 'common', description: 'Long silky locks' },
  { id: 'spiky', name: 'Spiky Anime Hair', icon: '💥', rarity: 'uncommon', description: 'Action hero spiky hair' },
  { id: 'messy', name: 'Messy Bedhead', icon: '🌪️', rarity: 'common', description: 'Casual unruly hair' },
  { id: 'curly', name: 'Curly Top', icon: '🌀', rarity: 'uncommon', description: 'Springy curly hair' },
  { id: 'mohawk', name: 'Punk Mohawk', icon: '🎸', rarity: 'rare', description: 'Rebellious spiked mohawk' },
  { id: 'ponytail', name: 'High Ponytail', icon: '🎀', rarity: 'uncommon', description: 'Athletic tied ponytail' },
  { id: 'anime', name: 'Protag Hair', icon: '✨', rarity: 'rare', description: 'Dynamic anime hairstyle' },
  { id: 'military', name: 'Military Flat Top', icon: '🪖', rarity: 'common', description: 'Strict military cut' },
  { id: 'wild', name: 'Wild Mane', icon: '🦁', rarity: 'epic', description: 'Voluminous wild hair' },
  { id: 'large_cartoon', name: 'Giant Puff Hair', icon: '☁️', rarity: 'epic', description: 'Oversized cartoon afro puff' },
  { id: 'afro', name: 'Disco Afro', icon: '🕺', rarity: 'legendary', description: 'Classic full afro' },
  { id: 'dreads', name: 'Cyber Dreads', icon: '🔌', rarity: 'rare', description: 'Futuristic braided dreadlocks' },
  { id: 'bob', name: 'Sleek Bob Cut', icon: '💇‍♀️', rarity: 'uncommon', description: 'Sharp symmetrical bob' },
];

export const HEADWEAR_CATALOG: CosmeticItem<HeadwearType>[] = [
  { id: 'none', name: 'None', icon: '❌', rarity: 'common', description: 'No hat equipped' },
  { id: 'cap', name: 'Detective Cap', icon: '🧢', rarity: 'common', description: 'Classic baseball cap' },
  { id: 'headband', name: 'Karate Bandana', icon: '🥋', rarity: 'common', description: 'Red martial arts headband' },
  { id: 'cowboy', name: 'Cowboy Hat', icon: '🤠', rarity: 'uncommon', description: 'Leather Stetson hat' },
  { id: 'crown', name: 'Royal Crown', icon: '👑', rarity: 'legendary', description: 'Golden jeweled crown' },
  { id: 'ninja', name: 'Ninja Hood', icon: '🥷', rarity: 'rare', description: 'Full assassin hood' },
  { id: 'horns', name: 'Viking Horns', icon: '⚔️', rarity: 'rare', description: 'Ancient battle helmet with horns' },
  { id: 'ribbon', name: 'Hair Ribbon', icon: '🎀', rarity: 'uncommon', description: 'Cute hair bow' },
  { id: 'boxing', name: 'Boxing Helmet', icon: '🥊', rarity: 'uncommon', description: 'Padded sparring headgear' },
  { id: 'military_helmet', name: 'Kevlar Combat Helmet', icon: '🪖', rarity: 'uncommon', description: 'Tactical army helmet' },
  { id: 'army_hat', name: 'Command Beret', icon: '🎖️', rarity: 'rare', description: 'Officer beret with badge' },
  { id: 'jungle_hat', name: 'Safari Bush Hat', icon: '🌿', rarity: 'uncommon', description: 'Wide-brimmed explorer hat' },
  { id: 'wizard', name: 'Pointy Sorcerer Hat', icon: '🧙‍♂️', rarity: 'epic', description: 'Magic hat with star embroidery' },
  { id: 'cone', name: 'Party Cone Hat', icon: '🎉', rarity: 'common', description: 'Festive paper party hat' },
  { id: 'helmet', name: 'Knight visor Helm', icon: '🛡️', rarity: 'rare', description: 'Steel medieval helmet' },
  { id: 'space_helmet', name: 'Astronaut Helmet', icon: '🚀', rarity: 'legendary', description: 'Sealed glass space visor' },
  { id: 'pirate', name: 'Pirate Tricorn', icon: '🏴‍☠️', rarity: 'epic', description: 'Feathered pirate captain hat' },
  { id: 'beanie', name: 'Cozy Beanie', icon: '❄️', rarity: 'common', description: 'Warm knitted winter beanie' },
  { id: 'samurai', name: 'Samurai Kabuto', icon: '⛩️', rarity: 'legendary', description: 'Ornate samurai helmet' },
  { id: 'ninja_headband', name: 'Leaf Shinobi Band', icon: '🍃', rarity: 'uncommon', description: 'Metal plate forehead protector' },
  { id: 'cat_ears', name: 'Cute Kitty Ears', icon: '🐱', rarity: 'rare', description: 'Playful cat ear headband' },
  { id: 'rabbit_ears', name: 'Fluffy Bunny Ears', icon: '🐰', rarity: 'epic', description: 'Long floppy bunny ears' },
  { id: 'devil_horns', name: 'Fiery Devil Horns', icon: '😈', rarity: 'epic', description: 'Glowing crimson horns' },
  { id: 'angel_halo', name: 'Glowing Angel Halo', icon: '😇', rarity: 'legendary', description: 'Floating golden holy ring' },
  { id: 'robot_antennas', name: 'Sci-Fi Antennas', icon: '🤖', rarity: 'rare', description: 'Blinking radio communication antennas' },
];

export const FACE_CATALOG: CosmeticItem<FaceType>[] = [
  { id: 'none', name: 'None', icon: '❌', rarity: 'common', description: 'No face accessory' },
  { id: 'sunglasses', name: 'Cool Shades', icon: '🕶️', rarity: 'common', description: 'Dark black sunglasses' },
  { id: 'round_glasses', name: 'Professor Glasses', icon: '👓', rarity: 'common', description: 'Classic round wireframes' },
  { id: 'pilot_glasses', name: 'Aviator Sunglasses', icon: '✈️', rarity: 'uncommon', description: 'Gold frame pilot aviators' },
  { id: 'eye_patch', name: 'Pirate Eye Patch', icon: '👁️', rarity: 'rare', description: 'Swashbuckler eye patch' },
  { id: 'ninja_mask', name: 'Stealth Face Mask', icon: '🥷', rarity: 'rare', description: 'Cloth lower face cover' },
  { id: 'bandit_mask', name: 'Bandit Bandana', icon: '🤠', rarity: 'uncommon', description: 'Outlaw neck bandana' },
  { id: 'gas_mask', name: 'Tactical Gas Mask', icon: '☣️', rarity: 'epic', description: 'Dual-filter respirator mask' },
  { id: 'samurai_mask', name: 'Oni Demon Mask', icon: '👹', rarity: 'legendary', description: 'Terrifying samurai mask' },
  { id: 'face_mask', name: 'Medical Face Mask', icon: '😷', rarity: 'common', description: 'Clean protective mask' },
  { id: 'cute_blush', name: 'Anime Blush', icon: '😊', rarity: 'uncommon', description: 'Pink cheeks effect' },
  { id: 'scar', name: 'Battle Scar', icon: '⚡', rarity: 'rare', description: 'Fierce eye scar' },
];

export const OUTFIT_CATALOG: CosmeticItem<OutfitType>[] = [
  { id: 'none', name: 'None / Classic', icon: '❌', rarity: 'common', description: 'Minimalist stickman form' },
  { id: 'cute_tshirt', name: 'Heart Graphic Tee', icon: '👕', rarity: 'common', description: 'Casual shirt with heart print' },
  { id: 'cute_hoodie', name: 'Bunny Pastel Hoodie', icon: '🐰', rarity: 'uncommon', description: 'Soft fluffy hoodie' },
  { id: 'cartoon', name: 'Toon Jumpsuit', icon: '🎨', rarity: 'uncommon', description: 'Bright comic jumpsuit' },
  { id: 'animal', name: 'Bear Onesie', icon: '🐻', rarity: 'rare', description: 'Cozy plush animal costume' },
  { id: 'colorful', name: 'Rainbow Jersey', icon: '🌈', rarity: 'common', description: 'Vibrant striped athletic shirt' },
  { id: 'combat', name: 'Tactical Kevlar Vest', icon: '🎽', rarity: 'rare', description: 'Heavy ballistic body armor' },
  { id: 'heavy_jacket', name: 'Leather Biker Coat', icon: '🧥', rarity: 'uncommon', description: 'Rugged leather coat' },
  { id: 'tactical', name: 'Spec-Ops Armor', icon: '🎖️', rarity: 'epic', description: 'Reinforced combat suit' },
  { id: 'dark_warrior', name: 'Shadow Knight Armor', icon: '🛡️', rarity: 'legendary', description: 'Spiked obsidian plate armor' },
  { id: 'soldier', name: 'Military Camo Uniform', icon: '🪖', rarity: 'rare', description: 'Standard army fatigues' },
  { id: 'military_jacket', name: 'Officer Trenchcoat', icon: '🧥', rarity: 'epic', description: 'Formal military overcoat' },
  { id: 'hoodie', name: 'Streetwear Hoodie', icon: '🧥', rarity: 'common', description: 'Classic zip-up hoodie' },
  { id: 'tshirt', name: 'Casual T-Shirt', icon: '👕', rarity: 'common', description: 'Simple cotton tee' },
  { id: 'jacket', name: 'Bomber Jacket', icon: '🧥', rarity: 'uncommon', description: 'Stylish flight jacket' },
  { id: 'coat', name: 'Winter Parka', icon: '🧥', rarity: 'uncommon', description: 'Warm heavy parka' },
  { id: 'sports', name: 'Athletic Tracksuit', icon: '🏃‍♂️', rarity: 'common', description: 'Sporty striped jacket' },
  { id: 'winter', name: 'Snow Puffer Coat', icon: '🌨️', rarity: 'uncommon', description: 'Insulated puffer jacket' },
  { id: 'ninja', name: 'Shinobi Shozoku', icon: '🥷', rarity: 'rare', description: 'Lightweight assassin robes' },
  { id: 'samurai', name: 'Samurai Yoroi', icon: '⛩️', rarity: 'legendary', description: 'Traditional lamellar plate armor' },
  { id: 'pirate', name: 'Swashbuckler Coat', icon: '🏴‍☠️', rarity: 'epic', description: 'Gold-trimmed pirate coat' },
  { id: 'space_suit', name: 'Space Explorer Suit', icon: '🚀', rarity: 'legendary', description: 'Pressure sealed suit' },
  { id: 'explorer', name: 'Safari Vest', icon: '🧭', rarity: 'uncommon', description: 'Pocketed explorer vest' },
  { id: 'royal', name: 'Emperor Robe', icon: '👑', rarity: 'legendary', description: 'Royal velvet tunic' },
  { id: 'wizard', name: 'Sorcerer Robe', icon: '🔮', rarity: 'epic', description: 'Magical starry robes' },
  { id: 'robot', name: 'Cyber Chassis', icon: '🤖', rarity: 'legendary', description: 'Reinforced robot torso' },
];

export const CAPE_CATALOG: CosmeticItem<CapeBackType>[] = [
  { id: 'none', name: 'None', icon: '❌', rarity: 'common', description: 'No back item equipped' },
  { id: 'short_cape', name: 'Hero Short Cape', icon: '🦸‍♂️', rarity: 'uncommon', description: 'Compact shoulder cape' },
  { id: 'long_cape', name: 'Flowing Long Cape', icon: '🚩', rarity: 'rare', description: 'Majestic trailing cape' },
  { id: 'torn_cape', name: 'Battle-Worn Cape', icon: '⚔️', rarity: 'rare', description: 'Tattered warrior cloak' },
  { id: 'royal_cape', name: 'Velvet Gold Cape', icon: '👑', rarity: 'epic', description: 'Ermine trimmed velvet cloak' },
  { id: 'ninja_cape', name: 'Shadow Scarf Cape', icon: '🥷', rarity: 'rare', description: 'Wind-blown ninja scarf' },
  { id: 'superhero_cape', name: 'Flying Hero Cape', icon: '🦸‍♀️', rarity: 'legendary', description: 'Dramatic billowing superhero cape' },
  { id: 'small_backpack', name: 'Hiker Backpack', icon: '🎒', rarity: 'common', description: 'Compact travel pack' },
  { id: 'large_backpack', name: 'Survival Rucksack', icon: '🧗‍♂️', rarity: 'uncommon', description: 'Heavy expedition pack' },
  { id: 'military_backpack', name: 'Assault Pack', icon: '🪖', rarity: 'rare', description: 'MOLLE tactical backpack' },
  { id: 'jetpack', name: 'Sci-Fi Jetpack', icon: '🚀', rarity: 'legendary', description: 'Dual-thruster rocket pack' },
  { id: 'angel_wings', name: 'Feathery Angel Wings', icon: '🪽', rarity: 'legendary', description: 'Pure white feathered wings' },
  { id: 'demon_wings', name: 'Bat Demon Wings', icon: '🦇', rarity: 'legendary', description: 'Dark membrane bat wings' },
  { id: 'small_wings', name: 'Pixie Fairy Wings', icon: '🧚‍♀️', rarity: 'epic', description: 'Delicate glowing wings' },
  { id: 'large_wings', name: 'Dragon Wings', icon: '🐉', rarity: 'legendary', description: 'Imposing dragon wing span' },
];

export const SHOE_CATALOG: CosmeticItem<ShoeType>[] = [
  { id: 'none', name: 'None / Barefoot', icon: '🦶', rarity: 'common', description: 'Bare feet' },
  { id: 'sneakers', name: 'Classic Kicks', icon: '👟', rarity: 'common', description: 'Casual low-top sneakers' },
  { id: 'boots', name: 'Heavy Work Boots', icon: '🥾', rarity: 'uncommon', description: 'Durable leather boots' },
  { id: 'military_boots', name: 'Combat Boots', icon: '🪖', rarity: 'rare', description: 'Steel-toe military boots' },
  { id: 'ninja_shoes', name: 'Ninja Tabi Shoes', icon: '🥷', rarity: 'rare', description: 'Silent split-toe footwear' },
  { id: 'samurai_sandals', name: 'Wooden Geta', icon: '🪵', rarity: 'rare', description: 'Traditional samurai wooden sandals' },
  { id: 'cartoon_shoes', name: 'Giant Clown Shoes', icon: '🤡', rarity: 'epic', description: 'Oversized cartoon shoes' },
  { id: 'sport_shoes', name: 'High-Top Kicks', icon: '🏀', rarity: 'uncommon', description: 'High-performance basketball shoes' },
  { id: 'winter_boots', name: 'Fur Snow Boots', icon: '❄️', rarity: 'uncommon', description: 'Warm winter boots' },
  { id: 'casual', name: 'Loafers', icon: '👞', rarity: 'common', description: 'Slip-on dress shoes' },
  { id: 'cute_shoes', name: 'Bunny Slippers', icon: '🐰', rarity: 'epic', description: 'Fluffy bunny head slippers' },
  { id: 'futuristic', name: 'Cyber Grav-Boots', icon: '⚡', rarity: 'legendary', description: 'Glowing anti-grav boots' },
];

export const ACCESSORY_CATALOG: CosmeticItem<AccessoryType>[] = [
  { id: 'none', name: 'None', icon: '❌', rarity: 'common', description: 'No accessory' },
  { id: 'earrings', name: 'Gold Hoop Earrings', icon: '✨', rarity: 'common', description: 'Shiny ear hoops' },
  { id: 'piercings', name: 'Silver Lip Ring', icon: '💍', rarity: 'uncommon', description: 'Punk facial piercing' },
  { id: 'necklace', name: 'Gold Chain Necklace', icon: '📿', rarity: 'rare', description: 'Heavy gold link chain' },
  { id: 'bracelet', name: 'Leather Wristband', icon: '⌚', rarity: 'common', description: 'Studded wristband' },
  { id: 'watch', name: 'Luxury Watch', icon: '🕒', rarity: 'uncommon', description: 'Gold chronograph watch' },
  { id: 'chain', name: 'Heavy Punk Chain', icon: '⛓️', rarity: 'rare', description: 'Wallet chain strap' },
  { id: 'tie', name: 'Red Necktie', icon: '👔', rarity: 'common', description: 'Formal red tie' },
  { id: 'scarf', name: 'Cozy Winter Scarf', icon: '🧣', rarity: 'uncommon', description: 'Knitted neck scarf' },
  { id: 'neck_band', name: 'Choker Collar', icon: '🖤', rarity: 'uncommon', description: 'Black neck band' },
  { id: 'shoulder_pad', name: 'Spiked Shoulder Guard', icon: '🛡️', rarity: 'epic', description: 'Pauldron shoulder armor' },
  { id: 'badge', name: 'Sheriff Star Badge', icon: '⭐', rarity: 'uncommon', description: 'Golden star badge' },
  { id: 'flower', name: 'Pink Flower Pin', icon: '🌸', rarity: 'common', description: 'Fresh pink blossom' },
  { id: 'ammo_belt', name: 'Ammo Bandolier', icon: '💣', rarity: 'legendary', description: 'Crossbody bullet belt' },
  { id: 'pins', name: 'Hero Button Pins', icon: '🔘', rarity: 'common', description: 'Collectible jacket pins' },
];

export const EFFECT_CATALOG: CosmeticItem<EffectType>[] = [
  { id: 'none', name: 'None', icon: '❌', rarity: 'common', description: 'No particle effect' },
  { id: 'hearts', name: 'Floating Hearts', icon: '❤️', rarity: 'epic', description: 'Rising romantic hearts' },
  { id: 'stars', name: 'Sparkle Stars', icon: '⭐', rarity: 'rare', description: 'Twinkling comic stars' },
  { id: 'electric', name: 'Lightning Sparks', icon: '⚡', rarity: 'legendary', description: 'Electric energy arcs' },
  { id: 'smoke', name: 'Shadow Smoke', icon: '💨', rarity: 'rare', description: 'Swirling dark mist' },
  { id: 'sparkles', name: 'Gold Magic Dust', icon: '✨', rarity: 'epic', description: 'Glowing golden sparkles' },
  { id: 'aura', name: 'Power Aura', icon: '🔥', rarity: 'legendary', description: 'Radiant energy aura' },
  { id: 'cute_particles', name: 'Pastel Bubbles', icon: '🫧', rarity: 'epic', description: 'Floating colorful bubbles' },
  { id: 'dark_smoke', name: 'Demonic Void Smoke', icon: '🌫️', rarity: 'legendary', description: 'Intense black smoke' },
  { id: 'light_glow', name: 'Angelic Halo Glow', icon: '🌟', rarity: 'legendary', description: 'Holy radiant light ring' },
];

export interface PresetOutfit {
  id: string;
  name: string;
  icon: string;
  description: string;
  customization: Partial<FighterCustomization>;
}

export const PRESET_OUTFITS: PresetOutfit[] = [
  {
    id: 'ninja',
    name: 'Shadow Ninja',
    icon: '🥷',
    description: 'Stealth assassin with headband, face mask, and tabi shoes',
    customization: {
      color: '#0F172A',
      secondaryColor: '#EF4444',
      accentColor: '#64748B',
      skin: 'shadow',
      hair: 'spiky',
      hairColor: '#0F172A',
      hat: 'ninja_headband',
      face: 'ninja_mask',
      outfit: 'ninja',
      cape: 'ninja_cape',
      shoes: 'ninja_shoes',
      accessory: 'none',
      effect: 'smoke',
    },
  },
  {
    id: 'soldier',
    name: 'Command Soldier',
    icon: '🪖',
    description: 'Heavy tactical soldier with helmet, Kevlar vest, and ammo belt',
    customization: {
      color: '#3B82F6',
      secondaryColor: '#1E3A8A',
      accentColor: '#F59E0B',
      skin: 'tan',
      hair: 'military',
      hairColor: '#1E293B',
      hat: 'military_helmet',
      face: 'gas_mask',
      outfit: 'soldier',
      cape: 'military_backpack',
      shoes: 'military_boots',
      accessory: 'ammo_belt',
      effect: 'none',
    },
  },
  {
    id: 'cute',
    name: 'Pastel Bunny',
    icon: '🐰',
    description: 'Adorable fighter with bunny ears, pastel hoodie, and hearts',
    customization: {
      color: '#F472B6',
      secondaryColor: '#A8E6CF',
      accentColor: '#FFD700',
      skin: 'light',
      hair: 'ponytail',
      hairColor: '#F472B6',
      hat: 'rabbit_ears',
      face: 'cute_blush',
      outfit: 'cute_hoodie',
      cape: 'small_wings',
      shoes: 'cute_shoes',
      accessory: 'flower',
      effect: 'hearts',
    },
  },
  {
    id: 'samurai',
    name: 'Honor Samurai',
    icon: '⛩️',
    description: 'Legendary warrior with Kabuto helmet, Oni mask, and Yoroi plate',
    customization: {
      color: '#DC2626',
      secondaryColor: '#F59E0B',
      accentColor: '#0F172A',
      skin: 'classic',
      hair: 'spiky',
      hairColor: '#0F172A',
      hat: 'samurai',
      face: 'samurai_mask',
      outfit: 'samurai',
      cape: 'torn_cape',
      shoes: 'samurai_sandals',
      accessory: 'none',
      effect: 'sparkles',
    },
  },
  {
    id: 'pirate',
    name: 'Pirate Captain',
    icon: '🏴‍☠️',
    description: 'Swashbuckler with tricorn hat, eye patch, coat, and gold chain',
    customization: {
      color: '#8D6E63',
      secondaryColor: '#EF4444',
      accentColor: '#FFD700',
      skin: 'tan',
      hair: 'long',
      hairColor: '#8D6E63',
      hat: 'pirate',
      face: 'eye_patch',
      outfit: 'pirate',
      cape: 'long_cape',
      shoes: 'boots',
      accessory: 'necklace',
      effect: 'none',
    },
  },
  {
    id: 'dark_warrior',
    name: 'Dark Warrior',
    icon: '😈',
    description: 'Terrifying warlord with devil horns, obsidian armor, and wings',
    customization: {
      color: '#111827',
      secondaryColor: '#991B1B',
      accentColor: '#DC2626',
      skin: 'shadow',
      hair: 'wild',
      hairColor: '#991B1B',
      hat: 'devil_horns',
      face: 'scar',
      outfit: 'dark_warrior',
      cape: 'demon_wings',
      shoes: 'military_boots',
      accessory: 'shoulder_pad',
      effect: 'dark_smoke',
    },
  },
  {
    id: 'space_explorer',
    name: 'Space Explorer',
    icon: '🚀',
    description: 'Galactic traveler with glass helmet, suit, and jetpack',
    customization: {
      color: '#06B6D4',
      secondaryColor: '#3B82F6',
      accentColor: '#FFD700',
      skin: 'cyber',
      hair: 'none',
      hairColor: '#0F172A',
      hat: 'space_helmet',
      face: 'pilot_glasses',
      outfit: 'space_suit',
      cape: 'jetpack',
      shoes: 'futuristic',
      accessory: 'none',
      effect: 'electric',
    },
  },
  {
    id: 'angel',
    name: 'Holy Angel',
    icon: '😇',
    description: 'Divine champion with floating halo, golden robes, and white wings',
    customization: {
      color: '#FFFFFF',
      secondaryColor: '#FBBF24',
      accentColor: '#38BDF8',
      skin: 'golden',
      hair: 'long',
      hairColor: '#FFD700',
      hat: 'angel_halo',
      face: 'round_glasses',
      outfit: 'royal',
      cape: 'angel_wings',
      shoes: 'casual',
      accessory: 'necklace',
      effect: 'light_glow',
    },
  },
  {
    id: 'demon',
    name: 'Demon Lord',
    icon: '👹',
    description: 'Infernal demon with horns, Oni mask, bat wings, and power aura',
    customization: {
      color: '#991B1B',
      secondaryColor: '#F97316',
      accentColor: '#111827',
      skin: 'neon',
      hair: 'spiky',
      hairColor: '#EF4444',
      hat: 'devil_horns',
      face: 'samurai_mask',
      outfit: 'dark_warrior',
      cape: 'demon_wings',
      shoes: 'boots',
      accessory: 'shoulder_pad',
      effect: 'aura',
    },
  },
];

export function getRandomCosmeticItem<T extends string>(catalog: CosmeticItem<T>[]): T {
  return catalog[Math.floor(Math.random() * catalog.length)].id;
}

export function generateRandomBotCustomization(botName?: string): FighterCustomization {
  const primary = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex;
  const secondary = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex;
  const accent = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex;

  const presetChance = Math.random();
  if (presetChance < 0.45) {
    const p = PRESET_OUTFITS[Math.floor(Math.random() * PRESET_OUTFITS.length)];
    return {
      name: botName || `Bot-${Math.floor(Math.random() * 900 + 100)}`,
      gender: Math.random() > 0.5 ? 'male' : 'female',
      color: primary,
      secondaryColor: secondary,
      accentColor: accent,
      ...p.customization,
    };
  }

  return {
    name: botName || `Bot-${Math.floor(Math.random() * 900 + 100)}`,
    gender: Math.random() > 0.5 ? 'male' : 'female',
    color: primary,
    secondaryColor: secondary,
    accentColor: accent,
    skin: getRandomCosmeticItem(SKINS_CATALOG),
    hair: getRandomCosmeticItem(HAIR_CATALOG),
    hairColor: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex,
    hat: getRandomCosmeticItem(HEADWEAR_CATALOG),
    hatColor: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].hex,
    face: getRandomCosmeticItem(FACE_CATALOG),
    outfit: getRandomCosmeticItem(OUTFIT_CATALOG),
    outfitColor: secondary,
    cape: getRandomCosmeticItem(CAPE_CATALOG),
    capeColor: accent,
    shoes: getRandomCosmeticItem(SHOE_CATALOG),
    shoeColor: primary,
    accessory: getRandomCosmeticItem(ACCESSORY_CATALOG),
    effect: getRandomCosmeticItem(EFFECT_CATALOG),
  };
}
