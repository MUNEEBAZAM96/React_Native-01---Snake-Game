import * as React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';
import type { PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';

import { Coordinates, Direction } from '../Type/GestureEventtype';
import colours from '../Styles/colours';
import Snake from './Snake';

/** Grid columns; rows scale so the board fills the screen. */
const GRID_COLS = 20;

type GameStatus = 'playing' | 'paused' | 'gameover';
/** Why we paused: wall hit (auto) or user pressed Pause. */
type PauseReason = 'wall' | 'manual' | null;

function coordKey(c: Coordinates): string {
  return `${c.x},${c.y}`;
}

function isOpposite(a: Direction, b: Direction): boolean {
  return (
    (a === Direction.UP && b === Direction.DOWN) ||
    (a === Direction.DOWN && b === Direction.UP) ||
    (a === Direction.LEFT && b === Direction.RIGHT) ||
    (a === Direction.RIGHT && b === Direction.LEFT)
  );
}

function getNextHead(head: Coordinates, dir: Direction): Coordinates {
  switch (dir) {
    case Direction.UP:
      return { x: head.x, y: head.y - 1 };
    case Direction.DOWN:
      return { x: head.x, y: head.y + 1 };
    case Direction.LEFT:
      return { x: head.x - 1, y: head.y };
    case Direction.RIGHT:
    default:
      return { x: head.x + 1, y: head.y };
  }
}

function spawnFood(occupied: Coordinates[], cols: number, rows: number): Coordinates {
  const set = new Set(occupied.map(coordKey));
  for (let i = 0; i < cols * rows * 2; i++) {
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);
    const k = `${x},${y}`;
    if (!set.has(k)) return { x, y };
  }
  return { x: 0, y: 0 };
}

function createInitialState(cols: number, rows: number) {
  const midX = Math.floor(cols / 2);
  const midY = Math.floor(rows / 2);
  const initialSnake: Coordinates[] = [
    { x: midX, y: midY },
    { x: midX - 1, y: midY },
    { x: midX - 2, y: midY },
  ];
  return {
    snake: initialSnake,
    food: spawnFood(initialSnake, cols, rows),
    direction: Direction.RIGHT,
    score: 0,
  };
}

export default function Game(): React.ReactElement {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const boardW = windowW;
  const boardH = Math.max(120, windowH - insets.top - insets.bottom);
  const gridRows = Math.max(
    10,
    Math.round((boardH / boardW) * GRID_COLS)
  );

  const cellW = boardW / GRID_COLS;
  const cellH = boardH / gridRows;

  /** One bundle so snake + food + score stay in sync on first paint. */
  const initialBundle = React.useMemo(
    () => createInitialState(GRID_COLS, gridRows),
    [gridRows]
  );
  const [snake, setSnake] = React.useState<Coordinates[]>(
    () => initialBundle.snake
  );
  const [food, setFood] = React.useState<Coordinates>(() => initialBundle.food);
  const [direction, setDirection] = React.useState<Direction>(Direction.RIGHT);
  const [score, setScore] = React.useState(0);
  const [status, setStatus] = React.useState<GameStatus>('playing');
  const [pauseReason, setPauseReason] = React.useState<PauseReason>(null);

  const directionRef = React.useRef(direction);
  const foodRef = React.useRef(food);
  const statusRef = React.useRef(status);

  React.useEffect(() => {
    directionRef.current = direction;
  }, [direction]);
  React.useEffect(() => {
    foodRef.current = food;
  }, [food]);
  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const lastGridRowsRef = React.useRef<number | null>(null);
  const didMountRef = React.useRef(true);
  React.useEffect(() => {
    if (didMountRef.current) {
      didMountRef.current = false;
      lastGridRowsRef.current = gridRows;
      return;
    }
    if (lastGridRowsRef.current === gridRows) return;
    lastGridRowsRef.current = gridRows;
    const s = createInitialState(GRID_COLS, gridRows);
    setSnake(s.snake);
    setFood(s.food);
    setDirection(s.direction);
    setScore(s.score);
    setStatus('playing');
    setPauseReason(null);
  }, [gridRows]);

  // Slower base speed so the snake moves more gently.
  const speedMs = React.useMemo(
    () => Math.max(140, 260 - score * 8),
    [score]
  );

  const step = React.useCallback(() => {
    setSnake(prev => {
      // Extra safety: if for any reason the snake array is empty, don't move.
      if (!prev.length) return prev;

      if (statusRef.current !== 'playing') return prev;

      const dir = directionRef.current;
      const nextHead = getNextHead(prev[0], dir);

      /** Wall: stay inside the grid — pause instead of moving through. */
      if (
        nextHead.x < 0 ||
        nextHead.x >= GRID_COLS ||
        nextHead.y < 0 ||
        nextHead.y >= gridRows
      ) {
        setStatus('paused');
        setPauseReason('wall');
        return prev;
      }

      const willEat =
        nextHead.x === foodRef.current.x && nextHead.y === foodRef.current.y;
      const bodyCheck = willEat ? prev : prev.slice(0, -1);
      const hitSelf = bodyCheck.some(
        s => s.x === nextHead.x && s.y === nextHead.y
      );
      if (hitSelf) {
        setStatus('gameover');
        setPauseReason(null);
        return prev;
      }

      if (willEat) {
        const grown = [nextHead, ...prev];
        setScore(s => s + 1);
        setFood(spawnFood(grown, GRID_COLS, gridRows));
        return grown;
      }
      return [nextHead, ...prev.slice(0, -1)];
    });
  }, [gridRows]);

  React.useEffect(() => {
    if (status !== 'playing') return;
    const id = setInterval(step, speedMs);
    return () => clearInterval(id);
  }, [status, step, speedMs]);

  /**
   * Map swipe vector to UP/DOWN/LEFT/RIGHT. Uses the dominant axis so diagonals pick one direction.
   * Updates directionRef immediately so the next game tick uses the new direction (no React batch delay).
   */
  const applySwipeDirection = React.useCallback(
    (translationX: number, translationY: number) => {
      const playing = statusRef.current === 'playing';
      const paused = statusRef.current === 'paused';
      // While game over, ignore swipes. While paused (wall/manual), still accept direction so you can turn before Resume.
      if (!playing && !paused) return;

      const ax = Math.abs(translationX);
      const ay = Math.abs(translationY);
      const minSwipe = 20;
      if (Math.max(ax, ay) < minSwipe) return;

      const next: Direction =
        ax > ay
          ? translationX > 0
            ? Direction.RIGHT
            : Direction.LEFT
          : translationY > 0
          ? Direction.DOWN
          : Direction.UP;

      if (isOpposite(directionRef.current, next)) return;

      directionRef.current = next;
      setDirection(next);
    },
    []
  );

  /** Fires once when the finger lifts — more reliable than reading State.END inside onGestureEvent. */
  const onPanStateChange = React.useCallback(
    (e: PanGestureHandlerStateChangeEvent) => {
      if (e.nativeEvent.state !== State.END) return;
      const { translationX, translationY } = e.nativeEvent;
      applySwipeDirection(translationX, translationY);
    },
    [applySwipeDirection]
  );

  /** User Pause: pause the game and remember it was manual. */
  const handlePause = React.useCallback(() => {
    setStatus('paused');
    setPauseReason('manual');
  }, []);

  /** Resume: continue from pause (wall or manual). */
  const handleResume = React.useCallback(() => {
    if (status !== 'paused') return;
    setPauseReason(null);
    setStatus('playing');
  }, [status]);

  const handleRestart = React.useCallback(() => {
    const s = createInitialState(GRID_COLS, gridRows);
    setSnake(s.snake);
    setFood(s.food);
    setDirection(s.direction);
    setScore(s.score);
    setStatus('playing');
    setPauseReason(null);
  }, [gridRows]);

  const statusLabel =
    status === 'playing'
      ? 'Playing'
      : status === 'paused'
      ? pauseReason === 'wall'
        ? 'Paused — hit the wall'
        : 'Paused'
      : 'Game over';

  return (
    <View style={styles.root}>
      <PanGestureHandler onHandlerStateChange={onPanStateChange}>
        <View
          style={[
            styles.wall,
            {
              width: boardW,
              height: boardH,
              marginTop: insets.top,
              borderColor: colours.primary,
            },
          ]}
        >
          <Snake
            snake={snake}
            food={food}
            cellWidth={cellW}
            cellHeight={cellH}
          />

          <View style={styles.hud} pointerEvents="box-none">
            <View style={styles.hudLeft}>
              <Text style={styles.scoreText}>Score: {score}</Text>
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
            <View style={styles.hudButtons}>
              {status === 'playing' && (
                <Pressable
                  style={[styles.btn, styles.btnPause, styles.btnFirst]}
                  onPress={handlePause}
                >
                  <Text style={styles.btnText}>Pause</Text>
                </Pressable>
              )}
              {status === 'paused' && (
                <Pressable
                  style={[styles.btn, styles.btnResume, styles.btnFirst]}
                  onPress={handleResume}
                >
                  <Text style={styles.btnText}>Resume</Text>
                </Pressable>
              )}
              <Pressable style={[styles.btn, styles.btnRestart]} onPress={handleRestart}>
                <Text style={styles.btnText}>
                  {status === 'gameover' ? 'Play again' : 'Restart'}
                </Text>
              </Pressable>
            </View>
          </View>

          {(status === 'paused' || status === 'gameover') && (
            <View style={styles.dim}>
              <View style={styles.banner}>
                <Text style={styles.bannerTitle}>
                  {status === 'gameover'
                    ? 'Game over'
                    : pauseReason === 'wall'
                    ? 'Wall!'
                    : 'Paused'}
                </Text>
                <Text style={styles.bannerSub}>
                  {status === 'paused' && pauseReason === 'wall'
                    ? 'Turn away from the wall, then tap Resume.'
                    : status === 'paused'
                    ? 'Tap Resume to continue.'
                    : `Final score: ${score}`}
                </Text>
              </View>
            </View>
          )}
        </View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colours.quaternary,
    alignItems: 'center',
  },
  /** Thick border = visible “wall”; snake logic keeps positions inside 0..grid-1. */
  wall: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#d9f99d',
    borderWidth: 6,
    borderRadius: 8,
  },
  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingTop: 8,
    zIndex: 2,
  },
  hudLeft: { flex: 1 },
  hudButtons: { flexDirection: 'row', alignItems: 'center' },
  scoreText: {
    color: colours.primary,
    fontWeight: '800',
    fontSize: 17,
  },
  statusText: {
    color: '#166534',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 8,
  },
  btnFirst: {
    marginLeft: 0,
  },
  btnPause: { backgroundColor: '#4f46e5' },
  btnResume: { backgroundColor: '#059669' },
  btnRestart: { backgroundColor: '#b45309' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  banner: {
    backgroundColor: 'rgba(22,101,52,0.95)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    maxWidth: '90%',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  bannerSub: {
    color: colours.secondary,
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
});
