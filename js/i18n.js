/* Neon Gem Merge — tiny i18n layer.
 * Korean by default; English automatically for non-Korean devices.
 * The lobby language switch rewrites every [data-i18n] node and asks the
 * dynamic screens to render again.
 */

const KO = {
  score: '점수',
  best: '최고',
  next: '다음',
  pause: '일시정지',
  resume: '계속하기',
  restart: '다시 시작',
  soundOn: '소리 켜기',
  soundOff: '소리 끄기',
  tapToStart: '화면을 눌러 시작',
  danger: '위험',
  tutorialTitle: '같은 보석을 합쳐요',
  tutorial1: '좌우로 움직여 보석을 떨어뜨려요.',
  tutorial2: '같은 보석끼리 만나면 한 단계 위로 진화해요.',
  tutorial3: '위험선 위에 2.5초 머무르면 게임이 끝나요.',
  start: '시작하기',
  gameOver: '게임 오버',
  overMsg: '보석이 위험선을 넘었어요',
  newRecord: '새 최고 기록!',
  revive: '광고 보고 부활',
  reviveNote: '한 판에 한 번',
  retry: '다시 도전',
  loading: '준비 중…',
  adTag: '광고',
  adPlaying: '광고를 보는 중이에요',
  adReward: '보상 받기',
  adSkip: '닫기',
  adReady: '보상을 받을 수 있어요',
  bomb: '젬 제거',
  swap: '젬 교체',
  bombTip: '없앨 보석을 눌러 주세요',
  free: '무료',
  noGems: '아직 보석이 없어요',
  removed: '제거!',
  newGem: '새 보석',
  cosmicPop: '코스믹 폭발!',
  adFail: '광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  confirmRestart: '지금 다시 시작할까요?',
  gem1: '스파크', gem2: '글로우 오브', gem3: '프리즘', gem4: '아메지스트',
  gem5: '루비', gem6: '토파즈', gem7: '에메랄드', gem8: '사파이어',
  gem9: '오팔', gem10: '노바', gem11: '코스믹 다이아',
  codexTitle: '진화 도감',
  banner: '광고',
  rewardBomb: '젬 제거 +1',
  rewardSwap: '젬 교체 +1',
  reviveReward: '부활',

  /* lobby */
  play: '게임 시작',
  lobbyKicker: 'MERGE PUZZLE',
  lobbyHint: '같은 보석을 둘이 만나면, 한 단계 위로 진화',
  bestScore: '최고 점수',
  plays: '누적 플레이',
  playsUnit: '판',
  codexShort: '도감',
  star: '스타 코인',
  shop: '상점',
  codexTab: '도감 · 방법',
  welcome: '웰컴 보너스 +150',
  toLobby: '로비로 나가기',
  lobby: '로비로',
  earnedThisRun: '이번 판 획득',

  /* shop */
  shopTitle: '상점',
  themesTitle: '보석 테마',
  themesHint: '장착하면 게임판과 보석 색이 바로 바뀌어요',
  boostersTitle: '부스터',
  coinsTitle: '스타 코인',
  equipped: '장착 중',
  equip: '장착하기',
  buy: '구매',
  notEnough: '코인이 부족해요',
  bought: '구매 완료! 바로 장착했어요',
  equippedToast: '테마를 장착했어요',
  adCoinsBtn: '광고 보고 스타 코인 +150',
  adCoinsWait: '광고 준비 중…',
  adCoinsToast: '스타 코인 +150',
  adCoinsFree: '몇 번이든 무료',
  boosterBombDesc: '원하는 보석 하나를 없애요',
  boosterSwapDesc: '다음 보석을 다른 보석으로 바꿔요',
  packNote: '다음 판 시작 시 +2',
  packPending: '대기',
  ownedLabel: '보유',
  packUnit: '개',

  /* codex */
  codexTitleFull: '보석 도감',
  codexSub: '11단계 진화',
  lockedGem: '아직 못 만난 보석이에요',
  howTo: '게임 방법',
  tipsTitle: '팁',
  tip1: '짧은 간격으로 연달아 합치면 콤보 배수가 붙어요.',
  tip2: '큰 보석은 바닥에, 작은 보석은 위에 쌓으세요.',
  tip3: '부스터는 위험선이 가까워질 때 아껴 쓰세요.',
  points: '점',
  baseGem: '기본 보석',
  discovered: '발견',
  codexComplete: '모든 보석을 만났어요!'
};

const EN = {
  score: 'SCORE',
  best: 'BEST',
  next: 'NEXT',
  pause: 'Paused',
  resume: 'Resume',
  restart: 'Restart',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  tapToStart: 'Tap to start',
  danger: 'Danger',
  tutorialTitle: 'Merge matching gems',
  tutorial1: 'Slide left and right, then release to drop.',
  tutorial2: 'Two matching gems evolve into the next one.',
  tutorial3: 'Rest above the danger line for 2.5s and the run ends.',
  start: 'Let’s play',
  gameOver: 'Game over',
  overMsg: 'The gems went over the line',
  newRecord: 'New best!',
  revive: 'Watch ad to revive',
  reviveNote: 'Once per run',
  retry: 'Play again',
  loading: 'Loading…',
  adTag: 'AD',
  adPlaying: 'Your reward is on its way',
  adReward: 'Claim reward',
  adSkip: 'Close',
  adReady: 'Reward ready',
  bomb: 'Remove gem',
  swap: 'Swap gem',
  bombTip: 'Tap a gem to remove it',
  free: 'Free',
  noGems: 'No gems yet',
  removed: 'Gone!',
  newGem: 'New gem',
  cosmicPop: 'Cosmic burst!',
  adFail: 'The ad could not load. Please try again shortly.',
  confirmRestart: 'Restart this run?',
  gem1: 'Spark', gem2: 'Glow Orb', gem3: 'Prism', gem4: 'Amethyst',
  gem5: 'Ruby', gem6: 'Topaz', gem7: 'Emerald', gem8: 'Sapphire',
  gem9: 'Opal', gem10: 'Nova', gem11: 'Cosmic Diamond',
  codexTitle: 'Evolution',
  banner: 'AD',
  rewardBomb: 'Remove gem +1',
  rewardSwap: 'Swap gem +1',
  reviveReward: 'Revive',

  /* lobby */
  play: 'Start game',
  lobbyKicker: 'MERGE PUZZLE',
  lobbyHint: 'Two matching gems become one step brighter',
  bestScore: 'BEST SCORE',
  plays: 'RUNS',
  playsUnit: '',
  codexShort: 'CODEX',
  star: 'STAR COINS',
  shop: 'Shop',
  codexTab: 'Codex & how',
  welcome: 'Welcome bonus +150',
  toLobby: 'Leave to lobby',
  lobby: 'Lobby',
  earnedThisRun: 'Earned this run',

  /* shop */
  shopTitle: 'Shop',
  themesTitle: 'Gem themes',
  themesHint: 'One tap recolours the board and gems',
  boostersTitle: 'Boosters',
  coinsTitle: 'Star coins',
  equipped: 'Equipped',
  equip: 'Equip',
  buy: 'Buy',
  notEnough: 'Not enough coins',
  bought: 'Purchased — equipped!',
  equippedToast: 'Theme equipped',
  adCoinsBtn: 'Watch ad · +150 coins',
  adCoinsWait: 'Ad loading…',
  adCoinsToast: '+150 star coins',
  adCoinsFree: 'Free, as often as you like',
  boosterBombDesc: 'Remove any one gem',
  boosterSwapDesc: 'Swap the next gem',
  packNote: '+2 at the start of your next run',
  packPending: 'queued',
  ownedLabel: 'Owned',
  packUnit: '',

  /* codex */
  codexTitleFull: 'Gem codex',
  codexSub: '11 evolutions',
  lockedGem: 'A gem you have not met yet',
  howTo: 'How to play',
  tipsTitle: 'Tips',
  tip1: 'Merge again quickly to build a combo multiplier.',
  tip2: 'Keep big gems low and stack small ones above them.',
  tip3: 'Save boosters for when the danger line is close.',
  points: 'pts',
  baseGem: 'starting gem',
  discovered: 'Found',
  codexComplete: 'You have met every gem!'
};

const DICTS = { ko: KO, en: EN };

export function detectLang(savedLang = null) {
  let lang = 'ko';
  try {
    if (savedLang === 'ko' || savedLang === 'en') lang = savedLang;
    else {
      const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'ko';
      if (!/^ko/i.test(nav)) lang = 'en';
    }
    const forced = new URLSearchParams(location.search).get('lang');
    if (forced === 'ko' || forced === 'en') lang = forced;
  } catch (e) { /* SSR / privacy mode */ }
  return lang;
}

export function createI18n(lang) {
  const dict = DICTS[lang] || KO;
  const fallback = KO;
  const fn = (key) => dict[key] ?? fallback[key] ?? key;
  fn.lang = lang;
  fn.dict = dict;
  return fn;
}

export function applyStaticText(t) {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.hasAttribute('data-i18n-attr')) {
      el.setAttribute(el.getAttribute('data-i18n-attr'), val);
    } else {
      el.textContent = val;
    }
  });
  document.documentElement.lang = t.lang;
}
