/*
 * MazeQuest Mini — Level 1: "The Forgotten Cellar"
 *
 * Legend
 *   #  wall                 .  floor
 *   S  start                X  exit portal
 *   k  golden key           D  locked door   (Puzzle 1: find key -> open door)
 *   L  lever                G  lever gate    (Puzzle 2: pull lever -> open gate)
 *   ^  spike trap (timed)                    (Obstacle 3: time your run)
 *   B  crate (pushable)     P  pressure plate
 *   H  plate gate                            (Puzzle 4: push crate onto plate -> open gate)
 *   *  gem (collectible)    +  heart (restores 1 HP)
 *   c  checkpoint flag
 *
 * Zones:  A (start, key) -> door -> B (lever) -> gate -> C (spike corridor)
 *         -> D (crate puzzle) -> plate gate -> E (exit)
 */
window.MQ_LEVELS = [
  {
    id: 1,
    name: "The Forgotten Cellar",
    parTimeSec: 90,
    map: [
      "#####################",
      "#S...*.#....#.....*.#",
      "#.##.#.#.##.#.###.#.#",
      "#....#.D..*....*#...#",
      "#.###..###.###.##.#.#",
      "#*..#.##.....#..L.#.#",
      "#.#...k#.*#....#*...#",
      "###################G#",
      "#..*.^^.^^^.^^.^^.c.#",
      "#.###################",
      "#c*.##########......#",
      "#....B....P..H.....X#",
      "#..+##########.....*#",
      "#*..##########*....*#",
      "#####################",
    ],
  },
];
