// Draw the Pact word list: original, family-friendly, no brands / franchises / real people.
// Each line is "english|español|difficulty" (1 easy = drawable nouns for kids, 2 medium, 3 hard = actions,
// ideas, scenes). Lines are grouped under "# category". Every English and every Spanish word is unique, so two
// guess options never read the same in either language (checked by test/draw.js).
export const CATS = {
  animals: ['Animals', 'Animales', '🐾'], food: ['Food', 'Comida', '🍎'], home: ['At home', 'En casa', '🏠'],
  objects: ['Things', 'Cosas', '🎒'], clothes: ['Clothes', 'Ropa', '👕'], body: ['Body', 'Cuerpo', '✋'],
  places: ['Places', 'Lugares', '🗺️'], nature: ['Nature', 'Naturaleza', '🌳'], vehicles: ['Vehicles', 'Vehículos', '🚗'],
  sports: ['Sports & play', 'Deportes y juegos', '⚽'], jobs: ['People & jobs', 'Personas y oficios', '🧑‍🍳'],
  fantasy: ['Fantasy', 'Fantasía', '🐉'], music: ['Music', 'Música', '🎵'], actions: ['Actions', 'Acciones', '🏃'],
  ideas: ['Ideas & moments', 'Ideas y momentos', '💡']
};
const RAW = `
# animals
cat|gato|1
dog|perro|1
fish|pez|1
bird|pájaro|1
snake|serpiente|1
spider|araña|1
snail|caracol|1
frog|rana|1
duck|pato|1
cow|vaca|1
pig|cerdo|1
horse|caballo|1
sheep|oveja|1
rabbit|conejo|1
mouse|ratón|1
lion|león|1
elephant|elefante|1
giraffe|jirafa|1
monkey|mono|1
bear|oso|1
penguin|pingüino|1
turtle|tortuga|1
butterfly|mariposa|1
bee|abeja|1
ant|hormiga|1
owl|búho|1
shark|tiburón|1
whale|ballena|1
octopus|pulpo|1
crab|cangrejo|1
worm|gusano|1
chicken|gallina|1
zebra|cebra|1
tiger|tigre|1
dolphin|delfín|1
ladybug|mariquita|1
starfish|estrella de mar|1
jellyfish|medusa|1
bat|murciélago|1
fox|zorro|1
puppy|cachorro|1
kitten|gatito|1
goat|cabra|1
camel|camello|1
kangaroo|canguro|1
panda|panda|1
koala|koala|1
hippo|hipopótamo|1
crocodile|cocodrilo|1
seal|foca|2
deer|venado|2
squirrel|ardilla|2
hedgehog|erizo|2
dinosaur|dinosaurio|1
parrot|loro|1
flamingo|flamenco|2
peacock|pavo real|2
swan|cisne|2
lobster|langosta|2
seahorse|caballito de mar|2
caterpillar|oruga|2
dragonfly|libélula|2
raccoon|mapache|2
sloth|perezoso|2
beaver|castor|2
polar bear|oso polar|2
rhino|rinoceronte|2
gorilla|gorila|2
wolf|lobo|2
eagle|águila|2
hummingbird|colibrí|2
mosquito|mosquito|2
llama|llama|2
toucan|tucán|2
iguana|iguana|2
shrimp|camarón|2
woodpecker|pájaro carpintero|3
chameleon|camaleón|3
porcupine|puerco espín|3
firefly|luciérnaga|3
# food
apple|manzana|1
pizza|pizza|1
cake|pastel|1
ice cream|helado|1
egg|huevo|1
cookie|galleta|1
bread|pan|1
cheese|queso|1
banana|plátano|1
coconut|coco|1
mango|mango|1
corn|maíz|1
carrot|zanahoria|1
pineapple|piña|1
watermelon|sandía|1
strawberry|fresa|1
grapes|uvas|1
lemon|limón|1
cherry|cereza|1
pear|pera|1
orange|naranja|1
tomato|tomate|1
potato|papa|1
donut|dona|1
lollipop|paleta de caramelo|1
candy|dulce|1
cupcake|pastelito|1
soup|sopa|1
milk|leche|1
pumpkin|calabaza|1
taco|taco|2
juice|jugo|1
honey|miel|2
peanut|maní|2
sandwich|sándwich|1
hamburger|hamburguesa|1
hot dog|perro caliente|1
popcorn|palomitas|1
french fries|papas fritas|2
pancakes|panqueques|2
spaghetti|espaguetis|2
sushi|sushi|2
burrito|burrito|2
avocado|aguacate|2
broccoli|brócoli|2
chocolate|chocolate|2
ice pop|paleta helada|2
pie|tarta|2
birthday cake|pastel de cumpleaños|2
salad|ensalada|2
noodles|fideos|2
pepper|pimiento|2
onion|cebolla|2
empanada|empanada|2
tortilla|tortilla|2
rice|arroz|2
toast|pan tostado|2
waffle|wafle|2
cereal|cereal|2
peach|durazno|2
kiwi|kiwi|2
blueberry|arándano|2
churro|churro|2
tamale|tamal|2
garlic|ajo|3
smoothie|batido|3
pretzel|pretzel|3
cotton candy|algodón de azúcar|3
lemonade|limonada|3
flan|flan|3
# home
chair|silla|1
table|mesa|1
bed|cama|1
book|libro|1
cup|taza|1
spoon|cuchara|1
fork|tenedor|1
key|llave|1
door|puerta|1
window|ventana|1
clock|reloj|1
lamp|lámpara|1
candle|vela|1
pillow|almohada|1
sofa|sofá|1
plate|plato|1
bowl|tazón|1
bottle|botella|1
bucket|cubeta|1
soap|jabón|2
bathtub|bañera|2
toothbrush|cepillo de dientes|1
mirror|espejo|2
ladder|escalera|1
broom|escoba|2
trash can|bote de basura|2
towel|toalla|2
blanket|cobija|2
teapot|tetera|2
frying pan|sartén|2
television|televisión|1
computer|computadora|1
fan|ventilador|2
toilet|inodoro|2
shower|ducha|2
alarm clock|despertador|2
mailbox|buzón|2
oven|horno|2
light bulb|bombilla|1
refrigerator|nevera|3
microwave|microondas|3
washing machine|lavadora|3
blender|licuadora|3
fireplace|chimenea|3
doorbell|timbre|3
vacuum cleaner|aspiradora|3
curtains|cortinas|3
faucet|grifo|3
# objects
ball|pelota|1
pencil|lápiz|1
phone|teléfono|1
umbrella|paraguas|1
kite|cometa|1
balloon|globo|1
gift|regalo|1
teddy bear|oso de peluche|1
doll|muñeca|1
crayon|crayón|1
basket|canasta|1
box|caja|1
bell|campana|1
flag|bandera|1
coin|moneda|1
heart|corazón|1
snowman|muñeco de nieve|1
scissors|tijeras|1
hammer|martillo|2
camera|cámara|2
glasses|lentes|1
sunglasses|lentes de sol|1
headphones|audífonos|2
map|mapa|1
compass|brújula|2
anchor|ancla|2
trophy|trofeo|1
medal|medalla|2
magnet|imán|2
battery|batería|2
envelope|sobre|2
stamp|sello|2
calendar|calendario|2
paintbrush|pincel|2
piggy bank|alcancía|2
puzzle|rompecabezas|2
wheel|rueda|2
backpack|mochila|1
tent|tienda de campaña|2
yo-yo|yoyo|2
toy blocks|bloques|2
eraser|goma de borrar|2
ruler|regla|2
glue|pegamento|2
flashlight|linterna|2
ring|anillo|1
necklace|collar|2
comb|peine|2
lock|candado|2
shovel|pala|2
rope|cuerda|2
button|botón|2
dice|dados|1
bubble|burbuja|2
paper airplane|avión de papel|1
sandcastle|castillo de arena|2
jump rope|cuerda de saltar|2
treasure chest|cofre del tesoro|2
rubber duck|patito de hule|2
spinning top|trompo|2
domino|dominó|2
ice cube|cubito de hielo|2
wallet|cartera|3
needle|aguja|3
telescope|telescopio|3
microscope|microscopio|3
hourglass|reloj de arena|3
snow globe|globo de nieve|3
pinwheel|molinillo de viento|3
marbles|canicas|3
sunscreen|protector solar|3
scarecrow|espantapájaros|3
# clothes
hat|sombrero|1
shoe|zapato|1
sock|calcetín|1
shirt|camisa|1
pants|pantalones|1
dress|vestido|1
boots|botas|1
cap|gorra|1
scarf|bufanda|2
gloves|guantes|1
jacket|chaqueta|2
pajamas|pijama|2
tie|corbata|2
belt|cinturón|2
raincoat|impermeable|2
swimsuit|traje de baño|2
sneakers|zapatillas|2
apron|delantal|2
helmet|casco|1
sweater|suéter|2
skirt|falda|2
mask|máscara|2
watch|reloj de pulsera|2
flip-flops|chanclas|2
bow tie|corbatín|3
# body
eye|ojo|1
hand|mano|1
foot|pie|1
nose|nariz|1
mouth|boca|1
ear|oreja|1
tooth|diente|1
smile|sonrisa|1
hair|cabello|1
mustache|bigote|2
beard|barba|2
footprint|huella|2
knee|rodilla|2
tongue|lengua|2
thumb|pulgar|2
lips|labios|2
fingerprint|huella digital|3
elbow|codo|3
skeleton|esqueleto|3
muscles|músculos|3
freckles|pecas|3
brain|cerebro|3
# places
house|casa|1
castle|castillo|1
bridge|puente|1
lighthouse|faro|2
island|isla|1
beach|playa|1
desert|desierto|2
igloo|iglú|1
pyramid|pirámide|1
farm|granja|2
school|escuela|2
park|parque|2
playground|patio de juegos|2
tower|torre|1
barn|granero|2
garden|jardín|2
kitchen|cocina|2
bedroom|dormitorio|2
bathroom|baño|2
shop|tienda|2
treehouse|casa del árbol|2
fountain|fuente|2
statue|estatua|2
windmill|molino de viento|2
fence|cerca|2
swimming pool|piscina|2
doghouse|casita de perro|2
swing|columpio|1
slide|tobogán|1
museum|museo|3
library|biblioteca|3
hospital|hospital|3
airport|aeropuerto|3
zoo|zoológico|3
circus|circo|3
jungle|selva|3
cave|cueva|3
city|ciudad|3
classroom|salón de clases|3
bakery|panadería|3
supermarket|supermercado|3
pet shop|tienda de mascotas|3
haunted house|casa embrujada|3
space station|estación espacial|3
aquarium|acuario|3
stadium|estadio|3
train station|estación de tren|3
restaurant|restaurante|3
post office|oficina de correos|3
skyscraper|rascacielos|3
market|mercado|3
roller coaster|montaña rusa|3
carousel|carrusel|3
ferris wheel|rueda de la fortuna|3
escalator|escalera eléctrica|3
elevator|ascensor|3
# nature
tree|árbol|1
sun|sol|1
moon|luna|1
star|estrella|1
flower|flor|1
rainbow|arcoíris|1
cloud|nube|1
rain|lluvia|1
cactus|cactus|1
leaf|hoja|1
mushroom|hongo|1
rock|roca|1
grass|pasto|1
seashell|concha|1
snow|nieve|1
volcano|volcán|1
mountain|montaña|1
waterfall|cascada|2
palm tree|palmera|1
snowflake|copo de nieve|1
nest|nido|2
spiderweb|telaraña|2
beehive|colmena|2
puddle|charco|2
river|río|2
lake|lago|2
ocean|océano|2
ocean wave|ola|2
planet|planeta|1
sunflower|girasol|2
rose|rosa|2
tulip|tulipán|2
pine tree|pino|2
acorn|bellota|2
log|tronco|2
planet earth|planeta Tierra|2
earthquake|terremoto|3
tornado|tornado|3
hurricane|huracán|3
eclipse|eclipse|3
shadow|sombra|3
wind|viento|3
sunrise|amanecer|3
sunset|atardecer|3
iceberg|iceberg|3
constellation|constelación|3
black hole|agujero negro|3
lightning|relámpago|3
thunder|trueno|3
tide|marea|3
sandstorm|tormenta de arena|3
avalanche|avalancha|3
quicksand|arenas movedizas|3
fossil|fósil|3
cocoon|capullo|3
winter|invierno|3
summer|verano|3
autumn|otoño|3
spring|primavera|3
fog|niebla|3
coral reef|arrecife de coral|3
# vehicles
car|carro|1
boat|barco|1
train|tren|1
bus|autobús|1
bicycle|bicicleta|1
airplane|avión|1
rocket|cohete|1
truck|camión|1
taxi|taxi|1
helicopter|helicóptero|1
submarine|submarino|2
tractor|tractor|2
ambulance|ambulancia|2
police car|carro de policía|2
fire truck|camión de bomberos|2
hot air balloon|globo aerostático|2
skateboard|patineta|1
roller skates|patines|2
sailboat|velero|1
motorcycle|motocicleta|2
canoe|canoa|2
spaceship|nave espacial|1
school bus|autobús escolar|2
tow truck|grúa|2
excavator|excavadora|2
parachute|paracaídas|2
raft|balsa|2
pirate ship|barco pirata|2
traffic light|semáforo|3
traffic jam|embotellamiento|3
road trip|viaje por carretera|3
wheelbarrow|carretilla|3
cable car|teleférico|3
unicycle|monociclo|3
# sports
soccer ball|balón de fútbol|1
baseball|béisbol|2
basketball|baloncesto|2
tennis|tenis|2
surfboard|tabla de surf|2
soccer goal|portería|2
bowling|boliche|2
golf|golf|2
karate|karate|2
volleyball|voleibol|2
table tennis|tenis de mesa|2
trampoline|trampolín|2
race|carrera|2
fishing rod|caña de pescar|2
bow and arrow|arco y flecha|2
boxing gloves|guantes de boxeo|3
hockey|hockey|3
hide and seek|escondidas|3
tug of war|juego de la cuerda|3
chess|ajedrez|3
finish line|línea de meta|3
first place|primer lugar|3
last place|último lugar|3
hopscotch|rayuela|3
yoga|yoga|3
cartwheel|voltereta lateral|3
snowball fight|guerra de bolas de nieve|3
# jobs
baby|bebé|1
grandma|abuela|1
grandpa|abuelo|1
king|rey|1
queen|reina|1
princess|princesa|2
astronaut|astronauta|2
doctor|doctor|2
firefighter|bombero|2
chef|cocinero|2
farmer|granjero|2
teacher|maestro|2
clown|payaso|1
pirate|pirata|1
knight|caballero|2
police officer|policía|2
nurse|enfermero|2
dentist|dentista|2
artist|artista|2
builder|constructor|2
mail carrier|cartero|2
pilot|piloto|2
baker|panadero|2
dancer|bailarín|2
cowboy|vaquero|2
family|familia|2
lifeguard|salvavidas|3
scientist|científico|3
detective|detective|3
vet|veterinario|3
gardener|jardinero|3
musician|músico|3
referee|árbitro|3
diver|buzo|3
explorer|explorador|3
photographer|fotógrafo|3
mechanic|mecánico|3
twins|gemelos|3
# fantasy
ghost|fantasma|1
robot|robot|1
crown|corona|1
monster|monstruo|1
dragon|dragón|1
unicorn|unicornio|1
mermaid|sirena|1
wizard|mago|2
superhero|superhéroe|2
alien|extraterrestre|2
mummy|momia|2
treasure|tesoro|2
sword|espada|1
shield|escudo|2
magic wand|varita mágica|2
fairy|hada|2
giant|gigante|2
witch hat|sombrero de bruja|2
elf|duende|2
robot dog|perro robot|2
cape|capa|2
genie|genio|3
tooth fairy|hada de los dientes|3
time travel|viaje en el tiempo|3
invisible|invisible|3
treasure map|mapa del tesoro|3
flying carpet|alfombra voladora|3
crystal ball|bola de cristal|3
potion|poción|3
phoenix|fénix|3
cyclops|cíclope|3
yeti|yeti|3
sea monster|monstruo marino|3
dragon egg|huevo de dragón|3
# music
drum|tambor|1
guitar|guitarra|1
piano|piano|1
trumpet|trompeta|2
microphone|micrófono|2
violin|violín|2
maracas|maracas|2
flute|flauta|2
musical note|nota musical|1
radio|radio|2
harp|arpa|3
xylophone|xilófono|3
saxophone|saxofón|3
tambourine|pandereta|3
music|música|3
band|banda|3
concert|concierto|3
speaker|altavoz|3
accordion|acordeón|3
# actions
run|correr|2
jump|saltar|2
swim|nadar|2
sleep|dormir|2
eat|comer|2
drink|beber|2
dance|bailar|2
sing|cantar|2
read|leer|2
write|escribir|2
laugh|reír|2
cry|llorar|2
fly|volar|2
climb|escalar|2
cook|cocinar|2
paint|pintar|2
kick|patear|2
throw|lanzar|2
catch|atrapar|2
sneeze|estornudar|2
yawn|bostezar|2
wave|saludar|2
hug|abrazar|2
clap|aplaudir|2
sweep|barrer|2
surf|surfear|2
ski|esquiar|2
skate|patinar|2
dig|cavar|2
wash|lavar|2
whistle|silbar|2
snore|roncar|2
hide|esconderse|2
sit|sentarse|2
go fishing|ir de pesca|2
juggle|hacer malabares|3
brush your teeth|cepillarse los dientes|3
ride a bike|andar en bicicleta|3
water the plants|regar las plantas|3
knock on a door|tocar la puerta|3
melting|derretirse|3
sleepwalking|sonambulismo|3
daydream|soñar despierto|3
think|pensar|3
push|empujar|3
pull|jalar|3
blow bubbles|hacer burbujas|3
fall asleep|quedarse dormido|3
build|construir|3
tiptoe|andar de puntillas|3
wink|guiñar|3
shout|gritar|3
walk the dog|pasear al perro|3
plant a tree|plantar un árbol|3
bake a cake|hornear un pastel|3
make a wish|pedir un deseo|3
take a photo|tomar una foto|3
fly a kite|volar una cometa|3
stretch|estirarse|3
crawl|gatear|3
smell|oler|3
listen|escuchar|3
# ideas
fireworks|fuegos artificiales|2
echo|eco|3
reflection|reflejo|3
dream|sueño|3
electricity|electricidad|3
birthday party|fiesta de cumpleaños|3
wedding|boda|3
picnic|pícnic|3
homework|tarea|3
vacation|vacaciones|3
secret|secreto|3
surprise|sorpresa|3
idea|idea|3
happy|feliz|3
sad|triste|3
angry|enojado|3
scared|asustado|3
tired|cansado|3
hungry|hambriento|3
excited|emocionado|3
brave|valiente|3
shy|tímido|3
proud|orgulloso|3
bored|aburrido|3
lost|perdido|3
cold|frío|3
teamwork|trabajo en equipo|3
recycling|reciclaje|3
haircut|corte de pelo|3
hiccups|hipo|3
bedtime|hora de dormir|3
magic trick|truco de magia|3
selfie|selfi|3
carnival|carnaval|3
parade|desfile|3
gravity|gravedad|3
balance|equilibrio|3
speed|velocidad|3
noise|ruido|3
silence|silencio|3
friendship|amistad|3
peace|paz|3
luck|suerte|3
science|ciencia|3
imagination|imaginación|3
morning|mañana|3
midnight|medianoche|3
weekend|fin de semana|3
holiday|día festivo|3
new year|año nuevo|3
lunchtime|hora del almuerzo|3
first day of school|primer día de clases|3
loose tooth|diente flojo|3
map reading|leer un mapa|3
sleepover|pijamada|3
snow day|día de nieve|3
`;
export const WORDS = [];
{ let cat = 'objects'; for (const l of RAW.trim().split('\n')) { const s = l.trim(); if (!s) continue; if (s[0] === '#') { cat = s.slice(1).trim(); continue; } const [en, es, d] = s.split('|'); WORDS.push({ en, es, d: +d, c: cat }); } }
