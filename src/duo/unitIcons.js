/* A face for every unit.

   The course data names a unit by its Duolingo skill ("Verbs: Present Reflexive
   - Hitpa'el") and abbreviates it for narrow screens ("Pres.Reflx"), neither of
   which is much to look at on the path. So each of the eighty-four units gets a
   picture of what it teaches and a short readable name to sit under it.

   Grammar units share a visual family on purpose: tense units are transport
   controls (rewind for the past, fast-forward for the future), adjectives are
   sparkles, prepositions are places. The eye learns the shape before it reads
   the word. */

import {
  ALargeSmall, ArrowLeftRight, Ban, Baby, Blocks, Box, Brain, Briefcase, Building2, Bike,
  Calculator, ChefHat, ChevronsRight, Clock, CloudSun, Compass, Copy, FastForward, Flag,
  Fingerprint, Flame, FlaskConical, Gauge, GitBranch, GraduationCap, Hand, Handshake, Hash, HelpCircle,
  History, Home, Infinity as InfinityIcon, Landmark, Languages, Lightbulb,
  Map, MapPin, Megaphone, MessagesSquare, Music, Newspaper, Package, Paintbrush, PartyPopper,
  PawPrint, Plane, Pointer, Puzzle, Repeat, Repeat2, Rewind, Rocket, Scale, Scroll, Shapes,
  Shirt, Shuffle, Siren, SkipForward, Smartphone, Smile, SpellCheck, Sparkles, Sprout,
  Stethoscope, Swords, Tag, Target, TreePine, Type, Undo2, UserRound, Users, UsersRound, Utensils,
  Wind, Palette, Zap, Star,
} from "lucide-react";

/* [icon, name]. The name is what the path prints under the icon, so it is kept
   to roughly twelve characters — anything longer wraps into the nodes below. */
const UNITS = {
  1:  [Type, "Letters 1"],
  2:  [ALargeSmall, "Letters 2"],
  3:  [SpellCheck, "Letters 3"],
  4:  [Hand, "Greetings"],
  5:  [Sprout, "Basics"],
  6:  [Box, "There Is"],
  7:  [Sparkles, "Adjectives"],
  8:  [Utensils, "Food 1"],
  9:  [PawPrint, "Animals"],
  10: [Copy, "Plurals"],
  11: [Fingerprint, "Possessives 1"],
  12: [Sparkles, "Adjectives 1"],
  13: [Target, "Direct Object"],
  14: [ChefHat, "Food 2"],
  15: [Shirt, "Clothing"],
  16: [Zap, "Present Pa'al"],
  17: [Palette, "Colors"],
  18: [MapPin, "Prepositions 1"],
  19: [Hash, "Numbers 1"],
  20: [HelpCircle, "Questions"],
  21: [Pointer, "Determiners"],
  22: [Briefcase, "Occupations"],
  23: [Repeat2, "Conjunctions"],
  24: [Compass, "Prepositions 2"],
  25: [Tag, "Possessives 2"],
  26: [Flame, "Present Pi'el"],
  27: [Clock, "Time & Dates"],
  28: [Sparkles, "Adjectives 2"],
  29: [Gauge, "Adverbs"],
  30: [Users, "Family"],
  31: [Home, "Home"],
  32: [Blocks, "Construct 1"],
  33: [InfinityIcon, "Infinitives 1"],
  34: [CloudSun, "Weather"],
  35: [Map, "Places"],
  36: [Wind, "Present Hif'il"],
  37: [UsersRound, "People"],
  38: [Calculator, "Numbers 2"],
  39: [Lightbulb, "Modals"],
  40: [GraduationCap, "Education"],
  41: [Plane, "Travel"],
  42: [Rewind, "Past Tense 1"],
  43: [Scale, "Comparison"],
  44: [Package, "Objects"],
  45: [Repeat, "Hitpa'el Verbs"],
  46: [Sparkles, "Adjectives 3"],
  47: [Brain, "Abstract 1"],
  48: [Megaphone, "Commands 1"],
  49: [Languages, "Languages"],
  50: [Siren, "Emergency"],
  51: [FastForward, "Future Tense"],
  52: [ArrowLeftRight, "Passive Voice"],
  53: [UserRound, "Reflexives"],
  54: [Undo2, "Nif'al Verbs"],
  55: [TreePine, "Nature"],
  56: [MessagesSquare, "Discussion"],
  57: [Megaphone, "Commands 2"],
  58: [History, "Past Tense 2"],
  59: [Rewind, "Past Nif'al"],
  60: [Smile, "Feelings"],
  61: [Shapes, "Geometry"],
  62: [Puzzle, "Abstract 2"],
  63: [InfinityIcon, "Infinitives 2"],
  64: [Newspaper, "Construct 2"],
  65: [GitBranch, "Conditional"],
  66: [Stethoscope, "Medical"],
  67: [SkipForward, "Future Tense 2"],
  68: [Scroll, "Religion"],
  69: [Paintbrush, "Arts"],
  70: [Ban, "Don't!"],
  71: [Smartphone, "Technology"],
  72: [Shuffle, "Verbal Nouns"],
  73: [FlaskConical, "Science"],
  74: [Music, "Music"],
  75: [Bike, "Sports"],
  76: [Landmark, "Politics"],
  77: [Baby, "Diminutives"],
  78: [Swords, "Legends"],
  79: [ChevronsRight, "Future Nif'al"],
  80: [Handshake, "Formal"],
  81: [Building2, "Business"],
  82: [Rocket, "Outer Space"],
  83: [PartyPopper, "Festivals"],
  84: [Flag, "Israel"],
};

/* The course JSON is the source of truth for which units exist, so a unit the
   table has never heard of still gets a face rather than a hole. */
export const unitIcon = (unit) => (UNITS[unit?.unit] || [])[0] || Star;

export const unitName = (unit) =>
  (UNITS[unit?.unit] || [])[1] || unit?.short || unit?.skill || `Unit ${unit?.unit}`;
