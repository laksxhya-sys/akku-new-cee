import { Template } from '../types';

export const INITIAL_TEMPLATES: Template[] = [
  {
    id: '1',
    title: 'Cyberpunk Avatar',
    description: 'Transform your portrait into a high-tech cyberpunk character with neon lights.',
    category: 'Avatar',
    imageUrl: 'https://picsum.photos/400/400?random=1',
    promptTemplate: 'Transform this person into a cyberpunk character with neon glowing circuitry on their face, futuristic city background, highly detailed, 8k resolution.',
    likes: 1240
  },
  {
    id: '2',
    title: 'Watercolor Dream',
    description: 'Turn any photo into a soft, dreamy watercolor painting.',
    category: 'Artistic',
    imageUrl: 'https://picsum.photos/400/400?random=2',
    promptTemplate: 'Convert this image into a soft watercolor painting style, pastel colors, dreamy atmosphere, wet-on-wet technique.',
    likes: 850
  },
  {
    id: '3',
    title: 'Pixar Style 3D',
    description: 'Reimagine yourself as a cute 3D animated character.',
    category: '3D',
    imageUrl: 'https://picsum.photos/400/400?random=3',
    promptTemplate: 'Create a 3D Pixar-style character based on this image, big eyes, soft lighting, cute expression, 3d render, octane render.',
    likes: 2100
  },
  {
    id: '4',
    title: 'Vintage Polaroid',
    description: 'Give your photos a nostalgic 90s polaroid vibe.',
    category: 'Photography',
    imageUrl: 'https://picsum.photos/400/400?random=4',
    promptTemplate: 'Apply a vintage 90s polaroid filter to this image, slightly faded colors, film grain, flash photography style.',
    likes: 540
  },
  {
    id: '5',
    title: 'Neon Noir',
    description: 'Dark, moody, and full of contrast.',
    category: 'Cinematic',
    imageUrl: 'https://picsum.photos/400/400?random=5',
    promptTemplate: 'Cinematic shot, neon noir style, dark shadows, high contrast, blue and magenta lighting, rain on glass.',
    likes: 920
  }
];