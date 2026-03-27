const ADJECTIVES = [
  'amber', 'ancient', 'arctic', 'autumn', 'bold',
  'bright', 'bronze', 'calm', 'clever', 'coral',
  'cosmic', 'crimson', 'crystal', 'daring', 'dawn',
  'dusty', 'eager', 'electric', 'emerald', 'fading',
  'fierce', 'floral', 'foggy', 'gentle', 'gilded',
  'golden', 'grand', 'hidden', 'hollow', 'humble',
  'ivory', 'jade', 'keen', 'lively', 'lunar',
  'maple', 'marble', 'mellow', 'mighty', 'misty',
  'mossy', 'noble', 'opal', 'pale', 'patient',
  'placid', 'polished', 'quiet', 'rapid', 'roaming',
  'royal', 'ruby', 'rustic', 'sage', 'scarlet',
  'serene', 'shadow', 'silent', 'silver', 'sleek',
  'snowy', 'solar', 'steady', 'stormy', 'subtle',
  'swift', 'tawny', 'tender', 'tidal', 'twilight',
  'velvet', 'verdant', 'violet', 'vivid', 'wandering',
  'warm', 'wild', 'winding', 'winter', 'wistful',
]

const ANIMALS = [
  'badger', 'bear', 'bison', 'bobcat', 'cardinal',
  'caribou', 'cat', 'chameleon', 'cheetah', 'cobra',
  'condor', 'crane', 'crow', 'deer', 'dolphin',
  'dove', 'eagle', 'egret', 'elk', 'falcon',
  'ferret', 'finch', 'flamingo', 'fox', 'gecko',
  'goose', 'gull', 'hare', 'hawk', 'hedgehog',
  'heron', 'ibis', 'iguana', 'jackal', 'jaguar',
  'jay', 'kestrel', 'kingfisher', 'kite', 'lark',
  'lemur', 'leopard', 'lion', 'llama', 'lynx',
  'macaw', 'mantis', 'marten', 'moose', 'moth',
  'newt', 'orca', 'osprey', 'otter', 'owl',
  'panther', 'parrot', 'pelican', 'puma', 'quail',
  'rabbit', 'raccoon', 'raven', 'robin', 'salmon',
  'seal', 'shrew', 'sparrow', 'stork', 'swan',
  'tapir', 'tern', 'thrush', 'tiger', 'toucan',
  'trout', 'turtle', 'viper', 'wolf', 'wren',
]

const pick = <T>(list: T[]): T =>
  list[Math.floor(Math.random() * list.length)]

export const generateDisplayName = (): string =>
  `${pick(ADJECTIVES)}-${pick(ANIMALS)}`
