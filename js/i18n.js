/* Neon Gem Merge — tiny i18n layer.
 * Korean by default; English automatically for non-Korean devices.
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
  reviveReward: '부활'
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
  reviveReward: 'Revive'
};

const DICTS = { ko: KO, en: EN };

export function detectLang() {
  let lang = 'ko';
  try {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'ko';
    if (!/^ko/i.test(nav)) lang = 'en';
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
