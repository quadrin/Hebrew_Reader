/* Pictures that do not show their word.

   Every picture in the course is the lead image of the English Wikipedia
   article the word names, which is the picture editors chose as the thing
   itself — and for a thing, that works: bread is bread and a camel is a
   camel. It does not work for a word that is not a thing. The article on
   Justice opens with a statue, Anxiety with a painting, Know with whatever
   the editors had, and a lesson that puts one of those beside three
   photographs and asks "which one of these is justice?" is asking the
   learner to guess how Wikipedia illustrates an abstraction. Nor does it work
   for a thing the article illustrates by example — Head is a meerkat's,
   Wall is the Great Wall — or for a person defined by a relation no
   photograph can show, since an aunt looks like anybody.

   These are the glosses whose pictures are kept out of the course: no
   new-word card opens with one, no picture question offers one, and the
   word drill asks about the word with words instead. The files stay on
   disk and in the credits, because a picture that fails as a definition is
   still somebody's photograph. Keyed the way the picture index is keyed —
   by the tidied gloss, see images.js — so an entry here is the entry there. */

export const VAGUE_PICTURES = new Set(`
abraham | academy | accessible | accident | address | aggadah | aggressive |
agora | agreeable | agricultural | air | alarm | allegory | allergy |
analysis | ancient | anesthesia | animals | annul | anonymity | antibiotics |
anxiety | anxious | architect | arena | argue | argues | argument | armlet |
arrow | art | atmosphere | audience | august | aunt | authority | automation |
avraham | award | baking | baking pan | balcony | bank | based |
basic training | beauty | begs | benign | bible | big data | biography |
biological diversity | biopsy | birth | birthday | biting | bless | blessing |
blood pressure | blood test | blue | bodyguards | boiled | boiler | border |
borrowed word | brand | bride | brittle | broadcast | browse | browsing |
buddhist | budget | bugging | building | buildings | bunker | bureaucracy |
bus line | buying | came | chairman | champions | chanukah | checkup |
childhood | children's story | civilian | climate | clinic | close friend |
cloud | cloudy | cold | collective farm | color | colorful | colour |
colourful | combat | comedic | comedy | comfort | comic | comics | committee |
communal settlement | communicated | communication | communications |
community | comparison | composer | concert | conquest | conscience |
construction | controversy | conversation | cooking | cooperation |
correspondent | costume | cough | counterfeit | court | courteous |
courthouse | craft | credit | crew | crime | critic | criticism | crop |
cruel | cruelty | cultural | culture | curiosity | curse | customer |
cut hair | dance | dances | daughter | debate | decree | defendant | define |
defines | definition | denial | design | designed | designs | desire |
despair | dictionary | digitized | dilemma | dinner | diploma | disagreeing |
disappointment | discussed | discussion | disease | dissertation | distance |
divides | dizziness | document | documented | documents | don't come |
donate | donation | double meaning | drama | drawing | dream | drink |
drinks | dripping | driving | duty | eat | eaten | eating | eats |
ecological system | edible | editing | editor | editorial board | educates |
education | elected official | elections | electric | electricity |
electronic mail | eloquence | emblem | emergency | emotion | emotional |
emotions | empathy | enclosed | encyclopedia | enemy | energy | engaged |
entertaining | envy | epistle | evening | everything | evil | evolution |
exam | exchange rate | exegesis | exercise | exile | expert | expertise |
expiry date | extinction | fable | failed | failure | failures | fair |
fairy tale | fall | family | fasted | fasting | fate | favorite |
feature article | felt | fever | filming | fine print | firm | first fruits |
fissure | flight | fog | folio | footnote | for rent | foreshadowing |
foreword | forged | forgetful | fossil fuels | freedom | friend |
frustration | frying | fuel | fun | furnishing | furniture | future | gadget |
gardening | garlic | gas | gaze | gemara | generation | giant | gifted |
glass | glitch | god | gods | good luck | goods | googled | gossip | gram |
granddad | granddaughter | grandfather | grandma | grandmother | grandpa |
grandson | green | grocery store | groom | guess | haggadah | handle |
handwriting | happiness | happy | harvest | have fun | head | headache |
headquarters | healing | heat | heat wave | heating | helpful | helping |
high-tech | hilarious | historic | historical | history | hobby | holds |
holiday | home loan | homily | honesty | hope | hopes | hospital |
hospitalization | hospitals | hostile | hotel | hotels | human being | humor |
humour | husband | hypothesis | idea | idiot | illustration | images |
imagination | imitate | immunized | impudence | inappropriate | independence |
infection | inflammation | initials | inn | innocence | innocent | institute |
insult | interest | interesting | irony | islam | jealousy |
jewish enlightenment | joke | judge | justice | keep | kibbutz | kilogram |
kilometer | knees | know | knowledge | known | knows | label | laboratory |
land | landlord | landscape | language | languages | laugh | leader | learn |
learned | learning | learns | lease | leaves | lecture | legend | legislate |
lesson | liberty | license | lie | life | light | linen | list | literary |
literature | loan | loneliness | looking | luck | ma'am | machine | madam |
manners | manufacturing | mass | match | matchmaking | material | may | meal |
measurement | medication | medicine | meeting | men | mentor | metaphor |
meteor | meter | midnight | military | military base | minutes | mishnah |
mist | model | mold | monday | month | morality | morning | motivation |
muscles | museum | muslim | must | name | narrated | narrative | nature |
nausea | negotiation | negotiations | neighborhood | news flash | newscast |
night | noon | nostalgia | notice | novel | novelty | officer | official |
ointment | online | opinion | orator | our father | overtaking | palm branch |
paper | parable | parents | passcode | passenger | password | past |
patience | pattern | payment | peace | pedestrian | penalty kick | perform |
performance | personification | pessimistic | pet | petrol | pets |
phenomenon | philosophical | philosophy | photo | photograph | photographs |
physician | physiotherapy | picture | pink | playing | pocket | politics |
pollute | polluted | poor | postal service | poverty | predict | prediction |
pregnancy | prepared | present | presentation | prices | pride |
prime minister | prince | princess | principle | privacy | prize |
profession | professional | professor | progresses | prophet | protect |
protest | psychologist | public | publication | publish | pundit | pupil |
pupils | purim | purple | rain | rainy | reading | recipe | recruitment |
reddish | referee | refuse | renaissance | renewable energy | rental |
renter | report card | reported | reporter | reproduction | rescue |
reserve duty | resource | resources | respect | retirement fund | revolution |
rhetoric | rift valley | right-handed | risk | room | rooms | rude | ruin |
running | sad | sadness | safe | safety | salve | sarcasm | satire |
saturday | saw | scenery | sceptre | schedule | scholarship | school |
scribe | scripture | scroll | sea | season | seasonal | seasoning | security |
seller | sermon | servant | shame | sharing | shaved | shekel | shekels |
shelter | shfela | shipping | shopping | shortening | siblings | side dishes |
sidewalk | signal | silence | simchat torah | similes | sincerity | sing |
singing | sings | sister | sit | sitting | skin | sleep | sleeping |
small town | sociable | social | society | software | soliloquy | solitude |
sound | sounds | sour | speed | spices | spicy | splits | spoke | spokesman |
sponge | sport | stable | star | statute | stinging | stock exchange |
stream | string | student | students | studio | studying | suffer |
suffering | supervisor | supreme court | surface | surfing | sweet |
swimming | tahini | talmudic | taught | team | tedious | territory |
testimony | texted | thank you | theory | thesis | think | thinking |
thought | time | tiredness | tolerate | tooth | topical | touch | tourists |
towelette | trade | tradition | traditional | traffic jams | trained |
training | transit card | translation | transportation | traveling | trend |
trial | troll | tumor | turning point | tv series | tzabar | uniforms |
vacation | vaccinated | vaccination | vacuum | vegetarian | velocity |
vendor | verdict | vertigo | victory | virtual reality | virtue | voice |
volume | volunteer | volunteered | voter | wadi | waiter | walk | walking |
wall | wand | war | warm up | waste | watchtowers | wave | wear | weather |
welcome | white | wife | wiki | wisdom | woman | women | word | wordplay |
worked out | workout | worried | worrying | wounds | write | writer |
writing | written | wrote | x-ray | yard | yelled | yellow | yeshiva | yoga |
yom kippur | youth |
`.split(/\s*\|\s*|\n/).map((s) => s.trim()).filter(Boolean));
