export type Floor = {
  number: number;
  name: string;
  subtitle: string;
  palette: string;
  interaction: string;
  reaction: string;
};

export const FLOORS: Floor[] = [
  { number: 1, name: "Neon Tokyo", subtitle: "雨の街 / city after rain", palette: "tokyo", interaction: "Chase a passing train", reaction: "Floor 1 has very strong main-character energy." },
  { number: 2, name: "Deep Ocean", subtitle: "800 metres below", palette: "ocean", interaction: "Wake the jellyfish", reaction: "Please do not tap the glass. The fish are judging us." },
  { number: 3, name: "Outer Space", subtitle: "orbiting the impossible", palette: "space", interaction: "Scan the planet", reaction: "No gravity, no problems. Probably." },
  { number: 4, name: "Enchanted Forest", subtitle: "where the roots remember", palette: "forest", interaction: "Call the fireflies", reaction: "The trees know your name. Keep that between us." },
  { number: 5, name: "Secret Arcade", subtitle: "insert coin / press start", palette: "arcade", interaction: "Play star catcher", reaction: "Floor 5: where high scores go to become legends." },
  { number: 6, name: "Japanese Garden", subtitle: "a quiet afternoon", palette: "garden", interaction: "Ring the garden bell", reaction: "Breathe in. Even the petals are taking their time." },
  { number: 7, name: "Lost Library", subtitle: "every spine has a secret", palette: "library", interaction: "Open the forbidden book", reaction: "A book chose you. That feels legally significant." },
  { number: 8, name: "Frozen Paradise", subtitle: "aurora over the snowline", palette: "frozen", interaction: "Warm the cabin window", reaction: "The cold is beautiful, but the cabin has snacks." },
  { number: 9, name: "Dream World", subtitle: "gravity is optional", palette: "dream", interaction: "Move a floating island", reaction: "Floor 9 is proof that clouds have excellent interior design." },
  { number: 10, name: "My Personal Reveal", subtitle: "you were not meant to find this", palette: "forbidden", interaction: "Look closer", reaction: "But somehow, you knew where to look." },
  { number: 11, name: "Sunset Paradise", subtitle: "the tide is on time", palette: "sunset", interaction: "Send a wave ashore", reaction: "A five-star sunset. Zero-star parking." },
  { number: 12, name: "Skyline Rooftop", subtitle: "above the last light", palette: "skyline", interaction: "Light the skyline", reaction: "The city looks better from up here. It knows it." },
  { number: 13, name: "Digital Dimension", subtitle: "reality, slightly corrupted", palette: "digital", interaction: "Stabilize the grid", reaction: "If the pixels start talking, be polite." },
];

export function floorByNumber(number: number) {
  return FLOORS.find((floor) => floor.number === number) ?? FLOORS[0];
}
