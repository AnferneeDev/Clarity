declare module "node-wav-player" {
  interface PlayOptions {
    path: string;
  }

  interface Player {
    play(options: PlayOptions): Promise<void>;
  }

  const player: Player;
  export default player;
}
