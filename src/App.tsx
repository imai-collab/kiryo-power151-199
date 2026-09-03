import React, { useState, useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import { RefreshCcw, ArrowRight, Play, CheckCircle, ArrowLeft, Trash2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";

type PieceType = "K" | "R" | "B" | "G" | "S" | "N" | "L" | "P" | "PR" | "PB" | "PS" | "PN" | "PL" | "PP";

interface Piece {
  type: PieceType;
  enemy: boolean;
}

interface Problem {
  id: number;
  name: string;
  board: Record<string, Piece>; // 'c,r' => Piece
  hand: PieceType[];
  solution: {
    from: string | null;
    to: string;
    pieceType: PieceType;
  };
}

import defaultPuzzles from "./puzzles.json";

const MOVES: Record<string, { dc: number; dr: number; slide?: boolean }[]> = {
  P: [{ dc: 0, dr: -1 }],
  L: [{ dc: 0, dr: -1, slide: true }],
  N: [
    { dc: -1, dr: -2 },
    { dc: 1, dr: -2 },
  ],
  S: [
    { dc: 0, dr: -1 },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 1 },
    { dc: 1, dr: 1 },
  ],
  G: [
    { dc: 0, dr: -1 },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
  ],
  K: [
    { dc: 0, dr: -1 },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 1 },
    { dc: 1, dr: 1 },
  ],
  B: [
    { dc: -1, dr: -1, slide: true },
    { dc: 1, dr: -1, slide: true },
    { dc: -1, dr: 1, slide: true },
    { dc: 1, dr: 1, slide: true },
  ],
  R: [
    { dc: 0, dr: -1, slide: true },
    { dc: 0, dr: 1, slide: true },
    { dc: -1, dr: 0, slide: true },
    { dc: 1, dr: 0, slide: true },
  ],
  PR: [
    { dc: 0, dr: -1, slide: true },
    { dc: 0, dr: 1, slide: true },
    { dc: -1, dr: 0, slide: true },
    { dc: 1, dr: 0, slide: true },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 1 },
    { dc: 1, dr: 1 },
  ],
  PB: [
    { dc: -1, dr: -1, slide: true },
    { dc: 1, dr: -1, slide: true },
    { dc: -1, dr: 1, slide: true },
    { dc: 1, dr: 1, slide: true },
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
  ],
  PS: [
    { dc: 0, dr: -1 },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
  ],
  PN: [
    { dc: 0, dr: -1 },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
  ],
  PL: [
    { dc: 0, dr: -1 },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
  ],
  PP: [
    { dc: 0, dr: -1 },
    { dc: -1, dr: -1 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
  ],
};

function getValidMoves(c: number, r: number, board: Record<string, Piece>) {
  const p = board[`${c},${r}`];
  if (!p) return [];

  let res: string[] = [];
  let moves = MOVES[p.type];
  const mul = p.enemy ? -1 : 1;
  for (let m of moves) {
    if (m.slide) {
      let nc = c + m.dc * mul;
      let nr = r + m.dr * mul;
      while (nc >= 0 && nc <= 5 && nr >= 0 && nr <= 5) {
        let target = board[`${nc},${nr}`];
        if (target) {
          if (target.enemy !== p.enemy) res.push(`${nc},${nr}`);
          break;
        }
        res.push(`${nc},${nr}`);
        nc += m.dc * mul;
        nr += m.dr * mul;
      }
    } else {
      let nc = c + m.dc * mul;
      let nr = r + m.dr * mul;
      if (nc >= 0 && nc <= 5 && nr >= 0 && nr <= 5) {
        let target = board[`${nc},${nr}`];
        if (!target || target.enemy !== p.enemy) {
          res.push(`${nc},${nr}`);
        }
      }
    }
  }
  return res;
}

function isKingInCheck(board: Record<string, Piece>, enemyKing: boolean) {
  let kx = -1,
    ky = -1;
  for (const [pos, p] of Object.entries(board)) {
    if (p.type === "K" && p.enemy === enemyKing) {
      const parts = pos.split(",");
      kx = parseInt(parts[0]);
      ky = parseInt(parts[1]);
      break;
    }
  }
  if (kx === -1) return false;

  for (const [pos, p] of Object.entries(board)) {
    if (p.enemy !== enemyKing) {
      const parts = pos.split(",");
      const c = parseInt(parts[0]);
      const r = parseInt(parts[1]);
      const moves = getValidMoves(c, r, board);
      if (moves.includes(`${kx},${ky}`)) {
        return true;
      }
    }
  }
  return false;
}

function getLegalMoves(board: Record<string, Piece>, isEnemy: boolean) {
  const legalMoves: { from: string; to: string }[] = [];
  for (const [pos, p] of Object.entries(board)) {
    if (p.enemy === isEnemy) {
      const parts = pos.split(",");
      const c = parseInt(parts[0]);
      const r = parseInt(parts[1]);
      const candidates = getValidMoves(c, r, board);
      for (const to of candidates) {
        const newBoard = { ...board };
        delete newBoard[pos];
        newBoard[to] = p;
        if (!isKingInCheck(newBoard, isEnemy)) {
          legalMoves.push({ from: pos, to });
        }
      }
    }
  }

  if (isEnemy) {
    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 6; r++) {
        const pos = `${c},${r}`;
        if (!board[pos]) {
          const newBoard = { ...board };
          newBoard[pos] = { type: "P", enemy: true };
          if (!isKingInCheck(newBoard, isEnemy)) {
            legalMoves.push({ from: "hand", to: pos });
          }
        }
      }
    }
  }

  return legalMoves;
}

const PieceView = ({
  type,
  enemy,
  selected,
}: {
  type: PieceType;
  enemy: boolean;
  selected?: boolean;
}) => {
  const meta = {
    K: { icon: "玉", title: "玉" },
    R: { icon: "飛", title: "飛" },
    B: { icon: "角", title: "角" },
    G: { icon: "金", title: "金" },
    S: { icon: "銀", title: "銀" },
    N: { icon: "桂", title: "桂" },
    L: { icon: "香", title: "香" },
    P: { icon: "歩", title: "歩" },
    PR: { icon: "龍", title: "龍", promoted: true },
    PB: { icon: "馬", title: "馬", promoted: true },
    PS: { icon: "全", title: "全", promoted: true },
    PN: { icon: "圭", title: "圭", promoted: true },
    PL: { icon: "杏", title: "杏", promoted: true },
    PP: { icon: "と", title: "と", promoted: true },
  }[type];

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${type === "K" ? "w-full" : "w-[90%]"} aspect-square rounded-[10px] border-[3px] transition-all select-none
       ${
         type === "K"
           ? "bg-[#FFF4D2] border-[#D9A300] shadow-[0_3px_0_#B38600]"
           : enemy
             ? "bg-[#FFF4D2] border-[#634C32] shadow-[0_3px_0_#D0B99B]"
             : "bg-[#FFFFFF] border-[#634C32] shadow-[0_3px_0_#D0B99B]"
       }
       ${enemy ? "rotate-180" : ""} 
       ${selected ? `scale-[1.15] z-10 box-shadow-xl ${type === "K" ? "border-[#FF5A5A]" : "border-[#FF5A5A]"}` : "hover:scale-105 cursor-pointer z-0"}`}
    >
      <span
        className={`text-2xl md:text-3xl font-bold leading-none drop-shadow-sm
        ${type === "K" ? "text-[#806000]" : meta.promoted ? (enemy ? "text-[#000000]" : "text-[#FF5A5A]") : "text-[#634C32]"}
        `}
      >
        {meta.icon}
      </span>
    </div>
  );
};

export default function App() {
  const [started, setStarted] = useState(false);
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [puzzlePage, setPuzzlePage] = useState(0);
  const PAGE_SIZE = 10;
  const [board, setBoard] = useState<Record<string, Piece>>({});
  const [hand, setHand] = useState<PieceType[]>([]);
  const [selected, setSelected] = useState<{
    from: string | null;
    pieceType: PieceType;
    handIdx?: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [puzzleResults, setPuzzleResults] = useState<Record<number, { solved: boolean; mistakes: number }>>({});
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showClearScreen, setShowClearScreen] = useState(false);
  const [clearUrl, setClearUrl] = useState<string>(
    () => localStorage.getItem("shogi_clear_url") || "https://ais-pre-e33pm4ybmbloliwg56zgz7-87151204104.asia-northeast1.run.app/complete?book=07"
  );
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [promotionPending, setPromotionPending] = useState<{
    from: string | null;
    to: string;
    handIdx?: number;
    pieceType: PieceType;
    promotedPieceType: PieceType;
  } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [timerActive, setTimerActive] = useState(false);
  const [showTimerEnd, setShowTimerEnd] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timerActive && timeLeft === 0) {
      setTimerActive(false);
      setShowTimerEnd(true);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  const toggleTimer = () => {
    if (timerActive) {
      setTimerActive(false);
    } else {
      setTimeLeft(300);
      setTimerActive(true);
      setShowTimerEnd(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const [editPieceInfo, setEditPieceInfo] = useState<{
    type: PieceType | "delete" | "move";
    enemy: boolean;
  }>({ type: "P", enemy: false });

  const [puzzles, setPuzzles] = useState<Problem[]>(() => {
    const saved = localStorage.getItem("shogi_puzzles");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (defaultPuzzles.length > 0 && parsed[0]?.id === (defaultPuzzles[0] as any)?.id) {
            return parsed;
          }
        }
      } catch (e) {
        console.error("Failed to parse saved puzzles:", e);
      }
    }
    return defaultPuzzles as Problem[];
  });
  const isDataLoaded = useRef(false);

  useEffect(() => {
    // Also try to fetch from API in case there are server-side updates, 
    // but localStorage takes priority for user-modified data if we want it strictly saved.
    // However, the user said "it returns to pre-loading data", so let's stick to localStorage for user actions.
    isDataLoaded.current = true;
  }, []);

  useEffect(() => {
    if (puzzles.length > 0) {
      localStorage.setItem("shogi_puzzles", JSON.stringify(puzzles));
      fetch("/api/save-puzzles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ puzzles }),
      }).catch(err => console.error("Failed to sync puzzles to server:", err));
    }
  }, [puzzles]);

  useEffect(() => {
    if (puzzleIdx < puzzles.length) {
      setBoard(puzzles[puzzleIdx].board);
      setHand(puzzles[puzzleIdx].hand);
      setSolved(false);
      setSelected(null);
      setErrorMsg(null);
      setAnimating(false);
      setPuzzlePage(Math.floor(puzzleIdx / PAGE_SIZE));
    }
  }, [puzzleIdx]); // Intentionally omitting `puzzles` to avoid triggering board reset during edit.

  useEffect(() => {
    if (isEditMode) {
      setPuzzles((prev) => {
        const newPuzzles = [...prev];
        const prevBoardStr = JSON.stringify(newPuzzles[puzzleIdx].board);
        const newBoardStr = JSON.stringify(board);
        const prevHandStr = JSON.stringify(newPuzzles[puzzleIdx].hand);
        const newHandStr = JSON.stringify(hand);

        if (prevBoardStr === newBoardStr && prevHandStr === newHandStr) {
          return prev;
        }

        newPuzzles[puzzleIdx] = {
          ...newPuzzles[puzzleIdx],
          board,
          hand,
        };
        return newPuzzles;
      });
    }
  }, [board, hand, isEditMode, puzzleIdx]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const base64 = (ev.target?.result as string).split(',')[1];
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          
          const response = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            contents: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64
                }
              },
              "このPDFデータは詰め将棋（1手詰）の問題集です。\n" +
              "すべての問題を抽出し、JSONで出力してください。\n" +
              "問題の作成ルール：\n" +
              "6x6マスの盤面として出力してください。" +
              "元の将棋が9x9の場合、例えば王がいる場所が2段目の2筋なら、その周辺(x:0~5, y:0~5の6x6)などをうまく6x6の盤面にマップして、王の手前と奥の空間が収まるように座標変換してください。\n" +
              "座標は左上のマスを(x:0, y:0)とします。王手(1手詰め)の課題なので、敵の玉は上部(y=0や1)に配置されてるのが一般的です。\n" +
              "駒(pieces配列)のプロパティ：\n" +
              "x: 0~5, y: 0~5, type: \"K\", \"R\", \"B\", \"G\", \"S\", \"N\", \"L\", \"P\", \"PR\", \"PB\", \"PS\", \"PN\", \"PL\", \"PP\"\n" +
              "成駒も抽出してください（PR=龍, PB=馬, PS=成銀, PN=成桂, PL=成香, PP=と金）。\n" +
              "enemy: プレイヤーから見て敵（詰められる側）の駒かどうか(boolean)\n\n" +
              "持ち駒(hand配列)：味方の持ち駒の種類の文字列配列。例: [\"G\", \"S\"]\n\n" +
              "出力は純粋なJSONのみにしてください。"
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "問題の名前または番号" },
                    hand: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    pieces: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          x: { type: Type.INTEGER },
                          y: { type: Type.INTEGER },
                          type: { type: Type.STRING },
                          enemy: { type: Type.BOOLEAN }
                        },
                        required: ["x", "y", "type", "enemy"]
                      }
                    }
                  },
                  required: ["name", "hand", "pieces"]
                }
              }
            }
          });

          const jsonStr = response.text || "[]";
          const parsed = JSON.parse(jsonStr) as { name: string, hand: PieceType[], pieces: {x:number, y:number, type:PieceType, enemy:boolean}[] }[];
          
          if (parsed && parsed.length > 0) {
            const newProblems = parsed.map((p, i) => {
              const boardRecord: Record<string, Piece> = {};
              p.pieces.forEach(piece => {
                boardRecord[`${piece.x},${piece.y}`] = {
                  type: piece.type,
                  enemy: piece.enemy
                };
              });
              return {
                id: Date.now() + i,
                name: p.name || `インポート問題 ${i+1}`,
                board: boardRecord,
                hand: p.hand || [],
                solution: { from: null, to: "0,0", pieceType: "P" as PieceType } // Dummy solution
              };
            });

            setPuzzles(prev => {
              const next = [...prev, ...newProblems];
              return next;
            });
            setErrorMsg(`${newProblems.length}問インポートしたにゃ！`);
          } else {
             setErrorMsg("問題をみつけられなかったにゃ...");
          }
        } catch (err) {
          console.error(err);
          setErrorMsg("インポート中にエラーが起きたにゃ...");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsImporting(false);
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const jsonStr = ev.target?.result as string;
        const parsed = JSON.parse(jsonStr) as Problem[];
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Simple validation: check if first item has required properties
          const first = parsed[0];
          if (first && typeof first === 'object' && 'board' in first && 'hand' in first) {
            setPuzzles(parsed);
            setPuzzleIdx(0);
            setPuzzlePage(0);
            setErrorMsg(`${parsed.length}問読み込んだにゃ！`);
          } else {
            setErrorMsg("データ形式がおかしいみたいだにゃ...");
          }
        } else {
          setErrorMsg("読み込める問題が見つからなかったにゃ...");
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("読み込みに失敗したにゃ...");
      } finally {
        if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const currentPuzzle = puzzles[puzzleIdx];

  const validMoves = useMemo(() => {
    if (!selected) return [];
    if (isEditMode && editPieceInfo.type === "move") {
      const res = [];
      for (let i = 0; i < 36; i++) {
        const c = i % 6;
        const r = Math.floor(i / 6);
        res.push(`${c},${r}`);
      }
      return res;
    }
    if (selected.from === null) {
      const res = [];
      for (let i = 0; i < 36; i++) {
        const c = i % 6;
        const r = Math.floor(i / 6);
        if (!board[`${c},${r}`]) {
          res.push(`${c},${r}`);
        }
      }
      return res;
    } else {
      const [sc, sr] = selected.from.split(",").map(Number);
      return getValidMoves(sc, sr, board);
    }
  }, [selected, board, isEditMode, editPieceInfo.type]);

  const executeMove = (
    from: string | null,
    to: string,
    handIdx: number | undefined,
    finalPieceType: PieceType
  ) => {
    const tempBoard = { ...board };
    if (from) {
      delete tempBoard[from];
    }
    tempBoard[to] = { type: finalPieceType, enemy: false };

    const isSelfCheck = isKingInCheck(tempBoard, false);
    if (isSelfCheck) {
      setErrorMsg("王手されてるにゃ！");
      setSelected(null);
      setTimeout(() => setErrorMsg(null), 1500);
      return;
    }

    const isCheck = isKingInCheck(tempBoard, true);
    const enemyReplies = getLegalMoves(tempBoard, true);
    const isCheckmate = isCheck && enemyReplies.length === 0;

    if (isCheckmate) {
      const newBoard = { ...board };
      if (from) {
        delete newBoard[from];
      } else if (handIdx !== undefined) {
        const newHand = [...hand];
        newHand.splice(handIdx, 1);
        setHand(newHand);
      }
      newBoard[to] = { type: finalPieceType, enemy: false };
      setBoard(newBoard);

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setSolved(true);
      setCorrectCount(c => c + 1);
      setPuzzleResults(prev => ({
        ...prev,
        [puzzleIdx]: {
          solved: true,
          mistakes: prev[puzzleIdx]?.mistakes || 0
        }
      }));
      setCombo(c => c + 1);
      setShowCombo(true);
      setTimeout(() => setShowCombo(false), 2000);
      setErrorMsg(null);
      setSelected(null);
    } else {
      const tBoard = { ...board };
      if (from) {
        delete tBoard[from];
      } else if (handIdx !== undefined) {
        const newHand = [...hand];
        newHand.splice(handIdx, 1);
        setHand(newHand);
      }
      tBoard[to] = { type: finalPieceType, enemy: false };
      setBoard(tBoard);
      setSelected(null);
      setAnimating(true);

      if (!isCheck) {
        setCombo(0);
        setMistakeCount(m => m + 1);
        setPuzzleResults(prev => ({
          ...prev,
          [puzzleIdx]: {
            solved: prev[puzzleIdx]?.solved || false,
            mistakes: (prev[puzzleIdx]?.mistakes || 0) + 1
          }
        }));
        setTimeout(() => {
          setErrorMsg("王手じゃないにゃ...");
          setTimeout(() => {
            if (timerActive) {
              nextPuzzle();
            } else {
              setBoard(currentPuzzle.board);
              setHand(currentPuzzle.hand);
            }
            setErrorMsg(null);
            setAnimating(false);
          }, 1000);
        }, 400);
        return;
      }

      setTimeout(() => {
        const replies = enemyReplies;
        if (replies.length > 0) {
          let reply = replies.find(
            (rep) =>
              rep.to === to &&
              rep.from !== "hand" &&
              tBoard[rep.from]?.type !== "K"
          );
          if (!reply) {
            reply = replies.find((rep) => rep.to === to);
          }
          if (!reply) {
            reply = replies.find(
              (rep) => rep.from !== "hand" && tBoard[rep.from].type === "K"
            );
          }
          if (!reply) {
            reply = replies.find((rep) => rep.from !== "hand");
          }
          if (!reply) {
            reply = replies.find((rep) => rep.from === "hand");
          }
          if (!reply) {
            reply = replies[0];
          }

          const nextBoard = { ...tBoard };
          if (reply.from === "hand") {
            nextBoard[reply.to] = { type: "P", enemy: true };
          } else {
            const p = nextBoard[reply.from];
            delete nextBoard[reply.from];
            nextBoard[reply.to] = p;
          }
          setBoard(nextBoard);
        }

        setTimeout(() => {
          setErrorMsg("防がれたにゃ...");
          setCombo(0);
          setMistakeCount(m => m + 1);
          setPuzzleResults(prev => ({
            ...prev,
            [puzzleIdx]: {
              solved: prev[puzzleIdx]?.solved || false,
              mistakes: (prev[puzzleIdx]?.mistakes || 0) + 1
            }
          }));
          setTimeout(() => {
            if (timerActive) {
              nextPuzzle();
            } else {
              setBoard(currentPuzzle.board);
              setHand(currentPuzzle.hand);
            }
            setErrorMsg(null);
            setAnimating(false);
          }, 1000);
        }, 600);
      }, 600);
    }
  };

  const handleCellClick = (c: number, r: number) => {
    if (animating) return;

    const key = `${c},${r}`;
    if (isEditMode) {
      if (editPieceInfo.type === "delete") {
        const newBoard = { ...board };
        delete newBoard[key];
        setBoard(newBoard);
      } else if (editPieceInfo.type === "move") {
        if (selected) {
          if (selected.from === key) {
            setSelected(null);
          } else if (selected.from !== null) {
            const newBoard = { ...board };
            const p = newBoard[selected.from];
            delete newBoard[selected.from];
            newBoard[key] = p;
            setBoard(newBoard);
            setSelected(null);
          } else if (selected.from === null && selected.handIdx !== undefined) {
            // Drop from hand
            const newHand = [...hand];
            const p = newHand.splice(selected.handIdx, 1)[0];
            setHand(newHand);
            setBoard({
              ...board,
              [key]: {
                type: p,
                enemy: false
              }
            });
            setSelected(null);
          }
        } else {
          if (board[key]) {
            setSelected({ from: key, pieceType: board[key].type });
          }
        }
      } else {
        setBoard({
          ...board,
          [key]: {
            type: editPieceInfo.type as PieceType,
            enemy: editPieceInfo.enemy,
          },
        });
      }
      return;
    }

    if (solved || !currentPuzzle) return;

    if (selected) {
      if (selected.from === key) {
        setSelected(null);
        return;
      }

      const isValidTarget = validMoves.includes(key);
      if (!isValidTarget) {
        const targetPiece = board[key];
        if (targetPiece && !targetPiece.enemy) {
          setSelected({ from: key, pieceType: targetPiece.type });
        } else {
          setSelected(null);
        }
        return;
      }

      const unpromotedToPromoted: Record<string, string> = {
        P: "PP",
        L: "PL",
        N: "PN",
        S: "PS",
        B: "PB",
        R: "PR",
      };

      let finalPieceType = selected.pieceType;
      let needsPromotionChoice = false;

      if (selected.from) {
        const fromR = parseInt(selected.from.split(",")[1]);
        const toR = r;
        const promotionZone = 2; // Ranks 0, 1, 2
        // If piece moves from or to the promotion zone and has a promoted form
        if ((fromR <= promotionZone || toR <= promotionZone) && unpromotedToPromoted[selected.pieceType]) {
          const promoteRequired = ((selected.pieceType === "P" || selected.pieceType === "L") && toR === 0) || (selected.pieceType === "N" && toR <= 1);
          if (promoteRequired) {
            finalPieceType = unpromotedToPromoted[selected.pieceType] as PieceType;
          } else {
            needsPromotionChoice = true;
          }
        }
      }

      if (needsPromotionChoice && !promotionPending) {
        setPromotionPending({
          from: selected.from,
          to: key,
          handIdx: selected.handIdx,
          pieceType: selected.pieceType,
          promotedPieceType: unpromotedToPromoted[selected.pieceType] as PieceType,
        });
        return;
      }

      executeMove(selected.from, key, selected.handIdx, finalPieceType);
    } else {
      const p = board[key];
      if (p && !p.enemy) {
        setSelected({ from: key, pieceType: p.type });
      }
    }
  };

  const handleHandClick = (idx: number, pieceType: PieceType) => {
    if (animating) return;
    if (isEditMode) {
      if (editPieceInfo.type === "move") {
        if (selected?.handIdx === idx) {
          setSelected(null);
        } else {
          setSelected({ from: null, pieceType, handIdx: idx });
        }
      } else {
        const newHand = [...hand];
        newHand.splice(idx, 1);
        setHand(newHand);
      }
      return;
    }
    if (solved || !currentPuzzle) return;
    if (selected?.handIdx === idx) {
      setSelected(null);
    } else {
      setSelected({ from: null, pieceType, handIdx: idx });
    }
  };

  const nextPuzzle = () => {
    const isSolved = (idx: number) => puzzleResults[idx]?.solved;
    const allSolved = puzzles.every((_, idx) => isSolved(idx));

    if (allSolved) {
      setShowClearScreen(true);
      setTimerActive(false);
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.3 } });
      return;
    }

    setSolved(false);
    setSelected(null);

    if (isRandomMode && puzzles.length > 1) {
      const unsolvedIndices = puzzles.map((_, i) => i).filter(i => !isSolved(i) && i !== puzzleIdx);
      if (unsolvedIndices.length > 0) {
        const nextIdx = unsolvedIndices[Math.floor(Math.random() * unsolvedIndices.length)];
        setPuzzleIdx(nextIdx);
      } else {
        // Current puzzle is the only unsolved one left
        setPuzzleIdx(puzzleIdx);
      }
    } else {
      for (let i = 1; i <= puzzles.length; i++) {
        const nextIdx = (puzzleIdx + i) % puzzles.length;
        if (!isSolved(nextIdx)) {
          setPuzzleIdx(nextIdx);
          break;
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#FFF0C1_0%,#FFF9E6_50%)] bg-[#FFF9E6] flex flex-col items-center justify-center p-4 md:p-8 font-sans overflow-hidden">
      <AnimatePresence>
        {showResultsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[110] flex items-center justify-center p-4"
          >
            <div className="bg-[#FFFFFF] border-4 border-[#FFADAD] rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-w-md w-full max-h-[80vh]">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-[#634C32]">せいせき詳細</h2>
                <button onClick={() => setShowResultsModal(false)} className="text-[#634C32] font-bold text-xl hover:text-[#FF5A5A]">✕</button>
              </div>
              <div className="overflow-y-auto space-y-2 pr-2">
                {(Object.entries(puzzleResults) as [string, { solved: boolean; mistakes: number }][]).filter(([_, result]) => result.mistakes > 0).length === 0 ? (
                  <div className="text-center text-[#634C32]/60 py-4 font-bold">間違えた問題はないにゃ</div>
                ) : (
                  (Object.entries(puzzleResults) as [string, { solved: boolean; mistakes: number }][])
                    .filter(([_, result]) => result.mistakes > 0)
                    .map(([idxStr, result]) => {
                      const problemIndex = parseInt(idxStr);
                      return (
                      <div 
                        key={idxStr} 
                        onClick={() => {
                          setPuzzleIdx(problemIndex);
                          setShowResultsModal(false);
                          setShowClearScreen(false); // Make sure clear screen is closed too, just in case
                        }}
                        className="flex justify-between items-center bg-[#FFEFEF] p-3 rounded-xl border-2 border-[#FFADAD] cursor-pointer hover:bg-[#FFD6D6] transition-colors"
                      >
                        <div className="font-bold text-[#634C32]">第{problemIndex + 1}問</div>
                        <div className="flex gap-4 font-bold text-sm items-center">
                          <div className={`${result.solved ? 'text-[#4A7A4A]' : 'text-[#634C32]/50'}`}>
                            {result.solved ? '正解！' : '未クリア'}
                          </div>
                          <div className="text-[#FF5A5A]">
                            ミス: {result.mistakes}回
                          </div>
                          <div className="text-[#FFADAD]">
                            <ArrowRight size={16} />
                          </div>
                        </div>
                      </div>
                    )})
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTimerEnd && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setShowTimerEnd(false)}
          >
            <div className="bg-[#FFFFFF] border-8 border-[#FF5A5A] rounded-[40px] p-10 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
              <h2 className="text-5xl font-black text-[#FF5A5A] tracking-wider">終了！</h2>
              <p className="text-xl font-bold text-[#634C32]">5分経過しましたにゃ！</p>
              <button 
                onClick={() => setShowTimerEnd(false)}
                className="mt-4 w-full py-4 bg-[#FFADAD] hover:bg-[#ff9999] text-white font-bold rounded-2xl shadow-[0_4px_0_#e68a8a] active:shadow-[0_0px_0_#e68a8a] active:translate-y-1 transition-all text-xl"
              >
                とじる
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promotion Dialog */}
      <AnimatePresence>
        {promotionPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-[#FFFFFF] border-4 border-[#F8D38D] rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full">
              <h2 className="text-2xl font-black text-[#634C32]">成りますか？</h2>
              <div className="flex gap-4 w-full">
                <button
                  onClick={() => {
                    executeMove(
                      promotionPending.from,
                      promotionPending.to,
                      promotionPending.handIdx,
                      promotionPending.promotedPieceType
                    );
                    setPromotionPending(null);
                  }}
                  className="flex-1 py-4 bg-[#FFADAD] hover:bg-[#ff9999] text-white font-bold rounded-xl shadow-[0_4px_0_#e68a8a] active:translate-y-1 active:shadow-none transition-all flex flex-col items-center gap-2"
                >
                  <span className="text-4xl leading-none">
                    {
                      {
                        PP: "と",
                        PL: "杏",
                        PN: "圭",
                        PS: "全",
                        PB: "馬",
                        PR: "龍",
                      }[promotionPending.promotedPieceType] || "龍"
                    }
                  </span>
                  <span className="text-lg">成る</span>
                </button>
                <button
                  onClick={() => {
                    executeMove(
                      promotionPending.from,
                      promotionPending.to,
                      promotionPending.handIdx,
                      promotionPending.pieceType
                    );
                    setPromotionPending(null);
                  }}
                  className="flex-1 py-4 bg-[#EAE8E3] hover:bg-[#D9D9D9] text-[#634C32] font-bold rounded-xl shadow-[0_4px_0_#CCCCCC] active:translate-y-1 active:shadow-none transition-all flex flex-col items-center gap-2"
                >
                  <span className="text-4xl leading-none">
                    {
                      {
                        P: "歩",
                        L: "香",
                        N: "桂",
                        S: "銀",
                        B: "角",
                        R: "飛",
                      }[promotionPending.pieceType] || "歩"
                    }
                  </span>
                  <span className="text-lg">成らない</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCombo && combo > 1 && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 50, rotate: -15 }}
            animate={{ scale: 1.2, opacity: 1, y: 0, rotate: 10 }}
            exit={{ scale: 0.5, opacity: 0, y: -50 }}
            className="fixed top-1/4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            <div className="relative">
              <span className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#FF5A5A] to-[#D04040] drop-shadow-[0_8px_0_#634C32] italic">
                {combo}
              </span>
              <span className="text-3xl md:text-5xl font-black text-[#634C32] ml-2 drop-shadow-[0_4px_0_#FFFFFF]">
                連続正解！！
              </span>
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="absolute -top-10 -right-10 text-5xl"
              >
                🔥
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!started ? (
          <motion.div
            key="start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm bg-[#FFFFFF] rounded-[40px] border-[8px] border-[#F8D38D] shadow-[0_15px_0_#EBC274] flex flex-col items-center p-[30px] relative text-center space-y-6"
          >
            <div className="relative">
              <div className="text-6xl mb-2 text-[#806000] font-bold bg-[#FFF4D2] border-[4px] border-[#D9A300] shadow-[0_4px_0_#B38600] rounded-xl w-24 h-24 flex items-center justify-center mx-auto">玉</div>
              <div className="text-3xl absolute -bottom-2 -right-2 text-[#634C32] font-bold bg-[#FFFFFF] border-[3px] border-[#634C32] shadow-[0_3px_0_#D0B99B] rounded-lg w-14 h-14 flex items-center justify-center translate-x-3 translate-y-1 z-10">歩</div>
            </div>
            <h1 className="text-3xl font-black text-[#634C32] tracking-tight">
              １手詰にゃう
            </h1>
            <p className="text-[#634C32] font-medium leading-relaxed">
              漢字の駒で１手詰に挑戦しよう！
              <br />
              全{puzzles.length}問！
            </p>
            <div className="w-full space-y-3">
              <button
                onClick={() => setStarted(true)}
                className="w-full py-4 bg-[#FFADAD] hover:bg-[#ff9999] text-white font-bold rounded-2xl shadow-[0_4px_0_#e68a8a] active:shadow-[0_0px_0_#e68a8a] active:translate-y-1 transition-all flex items-center justify-center gap-2 text-lg"
              >
                <Play size={20} /> はじめる
              </button>
              <button
                onClick={() => {
                  setIsRandomMode(true);
                  setPuzzleIdx(Math.floor(Math.random() * puzzles.length));
                  setStarted(true);
                }}
                className="w-full py-4 bg-[#F8D38D] hover:bg-[#ebc274] text-[#634C32] font-bold rounded-2xl shadow-[0_4px_0_#dca044] active:shadow-[0_0px_0_#dca044] active:translate-y-1 transition-all flex items-center justify-center gap-2 text-lg"
              >
                ランダムな問題で遊ぶ
              </button>
            </div>
          </motion.div>
        ) : showClearScreen ? (
          <motion.div
            key="end"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-[#FFFFFF] rounded-[40px] border-[8px] border-[#F8D38D] shadow-[0_15px_0_#EBC274] flex flex-col items-center p-[30px] relative text-center space-y-6"
          >
            <div className="text-6xl mb-2 animate-bounce">🎊</div>
            <h1 className="text-3xl font-black text-[#FF5A5A] drop-shadow-sm">全問正解！</h1>
            <p className="text-[#634C32] font-medium text-lg">
              すべての問題をクリアしたにゃ！
              <br />
              おめでとうにゃ！天才かも！
            </p>
            {mistakeCount === 0 && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                className="text-[#FF5A5A] font-bold text-xl bg-[#FFEFEF] border-4 border-[#FFADAD] px-6 py-3 rounded-2xl"
              >
                🌟 ノーミス達成！ 🌟
              </motion.div>
            )}
            <div className="w-full space-y-3 mt-4">
              <button
                onClick={() => {
                  if (clearUrl) {
                    window.open(clearUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                className="w-full py-4 bg-[#4CAF50] hover:bg-[#43A047] text-white font-bold rounded-2xl shadow-[0_4px_0_#2E7D32] active:shadow-[0_0px_0_#2E7D32] active:translate-y-1 transition-all flex items-center justify-center gap-2 text-lg"
              >
                <ExternalLink size={20} /> クリア登録
              </button>
              <button
                onClick={() => {
                  setShowClearScreen(false);
                  setCorrectCount(0);
                  setMistakeCount(0);
                  setPuzzleResults({});
                  setCombo(0);
                  setPuzzleIdx(0);
                  setIsRandomMode(false);
                  setTimerActive(false);
                  setTimeLeft(300);
                }}
                className="w-full py-4 bg-[#FFADAD] hover:bg-[#ff9999] text-white font-bold rounded-2xl shadow-[0_4px_0_#e68a8a] active:shadow-[0_0px_0_#e68a8a] active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCcw size={18} /> 最初からやり直す
              </button>
              <button
                onClick={() => {
                  setShowClearScreen(false);
                  setCorrectCount(0);
                  setMistakeCount(0);
                  setPuzzleResults({});
                  setCombo(0);
                  setIsRandomMode(true);
                  setPuzzleIdx(Math.floor(Math.random() * puzzles.length));
                  setTimerActive(false);
                  setTimeLeft(300);
                }}
                className="w-full py-4 bg-[#F8D38D] hover:bg-[#ebc274] text-[#634C32] font-bold rounded-2xl shadow-[0_4px_0_#dca044] active:shadow-[0_0px_0_#dca044] active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                ランダムでやり直す
              </button>
              <button
                onClick={() => setShowClearScreen(false)}
                className="w-full py-4 bg-[#EAE8E3] hover:bg-[#DEDCD7] text-[#634C32] font-bold rounded-2xl shadow-[0_4px_0_#CCCCCC] active:shadow-[0_0px_0_#CCCCCC] active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                閉じる
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="game"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-5xl flex flex-col lg:flex-row gap-6 md:gap-8 items-center lg:items-stretch justify-center"
          >
            <div className="w-full max-w-[420px] bg-[#FFFFFF] rounded-[40px] border-[8px] border-[#F8D38D] shadow-[0_15px_0_#EBC274] relative pt-[24px] pb-[30px] px-[20px] md:px-[24px]">
              {/* Header */}
              <div className="flex justify-between w-full mb-5 px-1 items-center">
                <span className="text-lg font-bold text-[#634C32]">
                  第 {puzzleIdx + 1} 問：{currentPuzzle.name}
                </span>
                <span className="text-lg font-bold text-[#FF7A7A]">
                  {puzzleIdx + 1}/{puzzles.length}
                </span>
              </div>

              {/* Game Area */}
              <div className="relative">
                {/* Status Message Overlay */}
                <div className="absolute top-2 left-0 right-0 z-20 flex justify-center pointer-events-none">
                  {errorMsg && (
                    <div className="bg-[#FF5A5A] text-white font-bold px-4 py-2 rounded-full shadow-lg animate-bounce">
                      {errorMsg}
                    </div>
                  )}
                </div>

                {/* Board */}
                <div className="grid grid-cols-6 grid-rows-6 gap-[4px] md:gap-[8px] bg-[#C3A16A] p-[8px] md:p-[12px] rounded-[16px] shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)] w-full max-w-[360px] lg:max-w-[420px] aspect-square mx-auto">
                  {Array.from({ length: 36 }).map((_, i) => {
                    const c = i % 6;
                    const r = Math.floor(i / 6);
                    const key = `${c},${r}`;
                    const piece = board[key];
                    const isSelected = selected && selected.from === key;
                    const isValidTarget = selected && validMoves.includes(key);

                    return (
                      <div
                        key={i}
                        onClick={() => handleCellClick(c, r)}
                        className={`bg-[#F7E7C3] rounded-lg relative flex items-center justify-center p-0.5 aspect-square
                          ${isValidTarget ? (piece ? "ring-2 ring-[#FF5A5A] cursor-pointer" : "ring-2 ring-[#FFADAD] cursor-pointer") : ""}
                          ${!piece && !isValidTarget ? "hover:bg-[#f3dfb4]" : ""}
                        `}
                      >
                        {!piece && (
                          <div className="absolute inset-1 rounded-lg border-2 border-dashed border-[#dca044] opacity-30 pointer-events-none" />
                        )}
                        {isValidTarget && !piece && (
                          <div className="absolute w-3 h-3 bg-[#FFADAD] rounded-full z-10 pointer-events-none" />
                        )}
                        {piece && (
                          <PieceView
                            type={piece.type}
                            enemy={piece.enemy}
                            selected={isSelected}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hand Area */}
                <div className="mt-6 flex flex-col gap-2">
                  <div className="flex items-center justify-between ml-1 relative">
                    <h3 className="font-bold text-[#634C32] flex items-center gap-2">
                      持ち駒
                    </h3>
                    {(timerActive || timeLeft < 300) && (
                      <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl text-[#FF5A5A] tabular-nums bg-white px-3 py-1 rounded-xl border-2 border-[#FFADAD] z-10 shadow-sm">
                        {formatTime(timeLeft)}
                      </div>
                    )}
                    <button 
                      onClick={toggleTimer}
                      className={`px-3 py-1.5 rounded-xl font-bold text-sm shadow-sm transition-all active:translate-y-px active:shadow-none ${
                        timerActive 
                          ? 'bg-white border-2 border-[#FF5A5A] text-[#FF5A5A] hover:bg-[#FFEFEF]'
                          : 'bg-[#FFADAD] text-white hover:bg-[#ff9999] shadow-[0_4px_0_#e68a8a] active:shadow-[0_0px_0_#e68a8a]'
                      }`}
                    >
                      {timerActive ? "タイマー停止" : "5分タイマー"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 min-h-[72px] bg-[#FFEEDD] p-3 border-[3px] border-dashed border-[#F8D38D] rounded-[24px] relative">
                    {solved && (
                      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="bg-[#C4E4C4] border-2 border-[#8DBF8D] text-[#4A7A4A] font-bold px-6 py-2 rounded-full shadow-lg text-xl flex items-center gap-2 animate-pulse">
                          <CheckCircle /> 正解！
                        </div>
                      </div>
                    )}
                    {hand.length === 0 && !solved && (
                      <div className="text-[#634C32]/40 font-bold m-auto">
                        なし
                      </div>
                    )}
                    {hand.map((p, idx) => {
                      const isSelected = selected?.handIdx === idx;
                      return (
                        <div
                          key={idx}
                          className="w-[60px] aspect-square flex items-center justify-center p-0.5"
                          onClick={() => handleHandClick(idx, p)}
                        >
                          <PieceView
                            type={p}
                            enemy={false}
                            selected={isSelected}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Next Button */}
                {solved && (
                  <button
                    onClick={nextPuzzle}
                    className="mt-6 w-full py-4 bg-[#FFADAD] hover:bg-[#ff9999] text-white font-bold rounded-2xl shadow-[0_4px_0_#e68a8a] active:shadow-[0_0px_0_#e68a8a] active:translate-y-1 transition-all flex items-center justify-center gap-2 text-lg animate-fade-in"
                  >
                    次の問題へ <ArrowRight />
                  </button>
                )}
              </div>
            </div>

            {/* Status Card (Right) */}
            <div className="w-full max-w-[420px] lg:w-[340px] bg-[#FFFFFF] rounded-[32px] border-[6px] border-[#FFADAD] p-5 flex flex-col gap-4 shadow-sm h-fit">
              <div className="bg-[#FFADAD] text-white px-4 py-2 rounded-2xl text-sm self-stretch font-bold space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <div>今のせいせき</div>
                  <button
                    onClick={() => {
                      setCorrectCount(0);
                      setMistakeCount(0);
                      setPuzzleResults({});
                      setCombo(0);
                      setStarted(false);
                      setIsRandomMode(false);
                      setPuzzleIdx(0);
                      setTimerActive(false);
                      setTimeLeft(300);
                    }}
                    className="bg-white text-[#FF5A5A] px-2 py-1 rounded-lg text-xs hover:bg-[#FFEFEF] active:scale-95 transition-all shadow-sm"
                  >
                    リセット
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs opacity-90">
                  <span>正解した問題数:</span>
                  <span>{correctCount}問</span>
                </div>
                <div className="flex justify-between items-center text-xs opacity-90">
                  <span>間違えた回数:</span>
                  <span>{mistakeCount}回</span>
                </div>
                <button 
                  onClick={() => setShowResultsModal(true)}
                  className="w-full mt-2 py-1.5 bg-white text-[#FF5A5A] rounded-xl text-xs hover:bg-[#FFEFEF] transition-colors shadow-sm active:translate-y-px active:shadow-none"
                >
                  せいせき一覧を見る
                </button>
              </div>
              <div className="w-[120px] h-[120px] bg-[#FFDEDE] rounded-[60px] mx-auto flex justify-center items-center text-6xl border-4 border-[#FFADAD] shadow-sm font-bold text-[#FF5A5A]">
                玉
              </div>
              <div className="bg-[#FFFFFF] border-[3px] border-[#634C32] p-3 rounded-2xl relative text-sm text-[#634C32] font-bold text-center mt-2 shadow-sm">
                <div className="absolute -top-[14px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[12px] border-l-transparent border-r-transparent border-b-[#634C32]"></div>
                <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#FFFFFF] z-10"></div>
                {solved ? (
                  "やったにゃ！大正解！"
                ) : (
                  <>
                    あと１手でつみだよ！
                    <br />
                    どこに置けばいいかにゃ？
                  </>
                )}
              </div>

              <div className="mt-4">
                {isEditMode && (
                  <div className="space-y-2 mb-3">
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(puzzles, null, 2));
                          const downloadAnchorNode = document.createElement('a');
                          downloadAnchorNode.setAttribute("href", dataStr);
                          downloadAnchorNode.setAttribute("download", "doubutsu-shogi-puzzles.json");
                          document.body.appendChild(downloadAnchorNode);
                          downloadAnchorNode.click();
                          downloadAnchorNode.remove();
                          alert("問題データをJSONファイルとしてダウンロードしました！\nこのファイルを使用して、別の環境で「ファイル読み込み」から復元できます。");
                        }}
                        className="w-full text-xs py-1.5 font-bold rounded-lg border-2 bg-[#EAE8E3] border-[#CCCCCC] text-[#634C32] hover:bg-[#D9D9D9] transition-all text-center flex items-center justify-center"
                      >
                        データ出力
                      </button>
                      <input
                        type="file"
                        accept=".json"
                        ref={jsonFileInputRef}
                        className="hidden"
                        onChange={handleJsonUpload}
                      />
                      <button
                        onClick={() => jsonFileInputRef.current?.click()}
                        className="w-full text-xs py-1.5 font-bold rounded-lg border-2 bg-[#E1F5FE] border-[#0288D1] text-[#01579B] hover:bg-[#B3E5FC] transition-all text-center flex items-center justify-center"
                      >
                        FILE読込
                      </button>
                      <input
                        type="file"
                        accept="application/pdf"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className={`w-full text-xs py-1.5 font-bold rounded-lg border-2 transition-all text-center flex items-center justify-center ${
                          isImporting ? "bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed" : "bg-[#FFF4D2] border-[#D9A300] text-[#806000] hover:bg-[#ffeaaa]"
                        }`}
                      >
                        {isImporting ? "読込中..." : "PDF追加"}
                      </button>
                    </div>
                    <div className="bg-[#FFF9E6] p-2.5 rounded-xl border-2 border-[#F8D38D] text-left">
                      <label className="block text-xs font-bold text-[#634C32] mb-1">
                        クリア登録URL:
                      </label>
                      <input
                        type="text"
                        value={clearUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClearUrl(val);
                          localStorage.setItem("shogi_clear_url", val);
                        }}
                        placeholder="https://..."
                        className="w-full text-xs p-2 rounded-lg border-2 border-[#DEDCD7] focus:outline-none focus:border-[#FFADAD] bg-white text-[#634C32] font-mono"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#634C32]">
                    もんだい いちらん
                  </h3>
                  <button 
                    onClick={() => setIsRandomMode(p => !p)}
                    className={`text-xs px-2.5 py-1 rounded-lg border-2 transition-all font-bold ${
                      isRandomMode 
                        ? "bg-purple-500 border-purple-700 text-white hover:bg-purple-600 shadow-inner" 
                        : "bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200"
                    }`}
                  >
                    ランダム出題: {isRandomMode ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {puzzles.slice(puzzlePage * PAGE_SIZE, (puzzlePage + 1) * PAGE_SIZE).map((_, i) => {
                    const idx = puzzlePage * PAGE_SIZE + i;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setPuzzleIdx(idx);
                          setIsEditMode(false);
                        }}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-sm sm:text-base border-2 cursor-pointer hover:opacity-80 transition-opacity
                        ${
                          puzzleResults[idx]?.solved
                            ? idx === puzzleIdx
                              ? "bg-[#A3E6A3] border-4 border-[#4A7A4A] text-[#2A5A2A]"
                              : "bg-[#C4E4C4] border-[#8DBF8D] text-[#4A7A4A]"
                            : idx === puzzleIdx
                              ? "bg-[#FF5A5A] border-4 border-[#D04040] text-white"
                              : "bg-[#FFEFEF] border-[#FFADAD] text-[#FF7A7A]"
                        }
                      `}
                      >
                        <div>{idx + 1}</div>
                        <div className="text-[10px] font-normal leading-none mt-1 opacity-90">
                          ミス: {puzzleResults[idx]?.mistakes || 0}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {puzzles.length > PAGE_SIZE && (
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={() => setPuzzlePage((p) => Math.max(0, p - 1))}
                      disabled={puzzlePage === 0}
                      className="px-3 py-1 rounded-full text-sm font-bold bg-[#EAE8E3] hover:bg-[#DEDCD7] text-[#634C32] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft size={16} />
                      前へ
                    </button>
                    <span className="text-sm font-bold text-[#634C32]">
                      {puzzlePage + 1} / {Math.ceil(puzzles.length / PAGE_SIZE)} ページ
                    </span>
                    <button
                      onClick={() => setPuzzlePage((p) => Math.min(Math.ceil(puzzles.length / PAGE_SIZE) - 1, p + 1))}
                      disabled={puzzlePage >= Math.ceil(puzzles.length / PAGE_SIZE) - 1}
                      className="px-3 py-1 rounded-full text-sm font-bold bg-[#EAE8E3] hover:bg-[#DEDCD7] text-[#634C32] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      次へ
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Mode Palette */}
              <div className="mt-2 border-t-2 border-[#FFADAD] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[#634C32]">盤面を編集する</h3>
                  <div className="flex gap-2">
                    {puzzles.length > 1 && isEditMode && (
                      <>
                        <button
                          onClick={() => {
                            if (puzzleIdx > 0) {
                              setPuzzles((prev) => {
                                const next = [...prev];
                                [next[puzzleIdx - 1], next[puzzleIdx]] = [next[puzzleIdx], next[puzzleIdx - 1]];
                                return next;
                              });
                              setPuzzleIdx(prev => prev - 1);
                            }
                          }}
                          disabled={puzzleIdx === 0}
                          className="px-2 py-1 rounded-full text-[#634C32] bg-[#EAE8E3] hover:bg-[#DEDCD7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="前へ移動"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (puzzleIdx < puzzles.length - 1) {
                              setPuzzles((prev) => {
                                const next = [...prev];
                                [next[puzzleIdx + 1], next[puzzleIdx]] = [next[puzzleIdx], next[puzzleIdx + 1]];
                                return next;
                              });
                              setPuzzleIdx(prev => prev + 1);
                            }
                          }}
                          disabled={puzzleIdx === puzzles.length - 1}
                          className="px-2 py-1 rounded-full text-[#634C32] bg-[#EAE8E3] hover:bg-[#DEDCD7] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="次へ移動"
                        >
                          <ArrowRight size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setPuzzles(prev => {
                              const next = prev.filter((_, i) => i !== puzzleIdx);
                              return next;
                            });
                            setPuzzleIdx(prev => Math.max(0, Math.min(prev, puzzles.length - 2)));
                            setIsEditMode(false);
                            setSelected(null);
                          }}
                          className="px-3 py-1 flex items-center gap-1 rounded-full text-sm font-bold bg-[#E6E6E6] text-[#666666] border-2 border-[#CCCCCC] hover:bg-[#D9D9D9] hover:text-[#ff3c3c] hover:border-[#ff9a9a] transition-all"
                        >
                          <Trash2 size={14} />
                          削除する
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        if (animating || solved) return;
                        setIsEditMode(!isEditMode);
                        if (!isEditMode) setSelected(null);
                      }}
                      className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${animating || solved ? "opacity-50 cursor-not-allowed" : ""} ${isEditMode ? "bg-[#FF5A5A] text-white shadow-inner" : "bg-[#FFEFEF] text-[#FF7A7A] border-2 border-[#FFADAD]"}`}
                    >
                      {isEditMode ? "編集中" : "編集モード"}
                    </button>
                  </div>
                </div>

                {isEditMode && (
                  <div className="flex flex-col gap-3 animate-fade-in bg-[#FFF9E6] p-3 rounded-xl border-2 border-[#F8D38D]">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setEditPieceInfo((p) => ({ ...p, enemy: false }))
                        }
                        className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${!editPieceInfo.enemy && editPieceInfo.type !== "delete" ? "bg-[#4A7A4A] text-white shadow-md scale-105" : "bg-[#C4E4C4] text-[#4A7A4A]"}`}
                      >
                        先手(味方)
                      </button>
                      <button
                        onClick={() =>
                          setEditPieceInfo((p) => ({ ...p, enemy: true }))
                        }
                        className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${editPieceInfo.enemy && editPieceInfo.type !== "delete" ? "bg-[#FF5A5A] text-white shadow-md scale-105" : "bg-[#FFADAD] text-[#FF5A5A]"}`}
                      >
                        後手(敵)
                      </button>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {(
                        [
                          "K",
                          "R",
                          "B",
                          "G",
                          "S",
                          "N",
                          "L",
                          "P",
                          "PR",
                          "PB",
                          "PS",
                          "PN",
                          "PL",
                          "PP",
                          "delete",
                          "move",
                        ] as const
                      ).map((pt) => (
                        <div
                          key={pt}
                          className={`cursor-pointer aspect-square rounded-xl flex justify-center items-center font-bold text-sm transition-all
                            ${editPieceInfo.type === pt ? "ring-4 ring-[#FFADAD] scale-110 bg-white" : "bg-[#F7E7C3] hover:scale-105"}`}
                          onClick={() => {
                            setEditPieceInfo({ ...editPieceInfo, type: pt });
                            setSelected(null);
                          }}
                        >
                          {pt === "delete" ? (
                            <span className="text-[#FF5A5A]">消す</span>
                          ) : pt === "move" ? (
                            <span className="text-[#4A7A4A]">移動</span>
                          ) : (
                            <div className="w-[80%] h-[80%] relative pointer-events-none">
                              <PieceView
                                type={pt as any}
                                enemy={editPieceInfo.enemy}
                                selected={false}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        if (editPieceInfo.type !== "delete" && editPieceInfo.type !== "move") {
                          setHand([...hand, editPieceInfo.type as PieceType]);
                        }
                      }}
                      disabled={editPieceInfo.type === "delete" || editPieceInfo.type === "move"}
                      className={`w-full py-2 font-bold rounded-lg mt-1 transition-colors ${(editPieceInfo.type === "delete" || editPieceInfo.type === "move") ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-[#F8D38D] hover:bg-[#ebc274] text-[#634C32] shadow-sm active:translate-y-1 active:shadow-none"}`}
                    >
                      選択中の駒を持ち駒に追加
                    </button>

                    <div className="text-xs text-[#634C32] opacity-80 text-center leading-relaxed mt-1">
                      {editPieceInfo.type === "move" ? (
                        <>盤面や持ち駒の駒を選んで、移動先を押してください。</>
                      ) : (
                        <>
                          盤面を押すと配置/削除できます。<br />
                          持ち駒を押すと削除できます。
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
