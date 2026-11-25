# Neon Gem Merge — 스토어 등록 & 수익化 가이드

이 문서는 `www/` 게임을 **구글 플레이 / 앱스토어**에 올리고 **AdMob 보상형 광고**로 수익화하기까지
필요한 모든 단계를 순서대로 정리한 실무 가이드입니다.

> 이미 완성되어 있는 것: 게임 전체, PWA(오프라인), Capacitor 설정, AdMob 어댑터, 아이콘, 테스트.
> 사용자가 직접 해야 하는 것: **AdMob 계정/광고 단위 만들기, 스토어 개발자 계정, 서명 키, 스토어 등록정보 입력, 심사 제출.**
> (계정·결제·약관 동의는 대신 만들 수 없습니다.)

---

## 0. 준비물 체크리스트

- [ ] Node.js 20 이상 + npm
- [ ] Android Studio (최신, SDK 35 이상) / macOS + Xcode 16 이상(iOS)
- [ ] AdMob 계정 (구글 계정으로 무료 생성)
- [ ] Google Play 개발자 계정 (등록비 1회 $25)
- [ ] Apple Developer Program (연 $99, iOS 배포 시)
- [ ] 개인정보 처리방침을 올릴 웹 주소 (노션 공개 페이지도 가능)

---

## 1. 지금 바로 웹에서 확인 / 배포 (PWA)

```bash
cd site/neon-gem-merge
python3 -m http.server 8080 --directory www
# 브라우저에서 http://localhost:8080
```

정적 호스팅(Netlify, Vercel, Cloudflare Pages, GitHub Pages, 카페24 등)에 **`www/` 폴더만** 올리면
그대로 설치형 앱(PWA)이 됩니다. HTTPS가 필수이며, `manifest.json`과 `sw.js`가 함께 있어야
"홈 화면에 추가"와 오프라인 실행이 동작합니다.

> 파일을 수정해 배포할 때는 `www/sw.js`의 `CACHE_NAME` 버전을 올려 주세요. (예: `v1.0.1`)

---

## 2. AdMob 설정

### 2-1. 앱 등록

1. <https://admob.google.com> → **앱 → 앱 추가**
2. 플랫폼을 **Android**로 선택 → 앱 이름 `Neon Gem Merge` → "스토어에 없음" 선택
3. 생성된 **앱 ID**(`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`)를 메모
4. iOS도 동일하게 한 번 더 등록 (앱 ID가 플랫폼별로 다릅니다)

### 2-2. 광고 단위 만들기

| 광고 단위 | 형식 | 사용처 |
| --- | --- | --- |
| `NeonGem_Banner` | 배너 (320×50) | 하단 고정 배너 |
| `NeonGem_Rewarded` | 보상형 | 젬 제거 / 젬 교체 / 부활 |

광고 단위마다 **광고 단위 ID**(`ca-app-pub-.../........`)가 발급됩니다. 앱 ID와 광고 단위 ID는 다릅니다.

### 2-3. 코드에 ID 넣기 (3곳)

1) `www/js/admob-bridge.js` 상단 `AD_IDS`

```js
export const AD_IDS = {
  android: {
    banner:   'ca-app-pub-내앱ID/배너단위ID',
    rewarded: 'ca-app-pub-내앱ID/보상형단위ID'
  },
  ios: { banner: '...', rewarded: '...' }
};
```

2) `android/app/src/main/AndroidManifest.xml` — `<application>` 안에 추가

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```

3) `ios/App/App/Info.plist`

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
```

> 위 2)·3) 항목이 없으면 앱이 **시작하자마자 크래시**합니다. 가장 흔한 실수입니다.

### 2-4. 테스트 광고

`www/js/admob-bridge.js`의 `isTesting`은 지금 `true`입니다. 구글 공식 테스트 ID가 들어 있어
실제 광고가 나가지 않고 수익도 잡히지 않습니다. **출시 직전에만 `false`로 바꾸고 실제 ID로 교체**하세요.
출시 후 자기 광고를 반복 클릭하면 계정이 정지될 수 있습니다.

- 보상형은 `showRewardVideoAd()`가 정상 종료된 뒤에만 보상을 지급하도록 이미 구현되어 있습니다
  (광고를 중간에 닫으면 보상 없음 → AdMob 정책 준수).
- 광고가 없을 때(NO_FILL)는 "광고를 불러오지 못했어요" 토스트만 표시되고 게임은 계속됩니다.

---

## 3. Android 빌드 (AAB)

```bash
cd site/neon-gem-merge
npm install
npx cap add android          # 최초 1회 (android/ 폴더 생성)
npx cap sync                 # www 변경분 반영 (수정할 때마다)
npx cap open android         # Android Studio 열기
```

Android Studio에서 `Run ▶`로 실기기 테스트 → 이상 없으면 릴리스 빌드.

### 서명 키 만들기 (최초 1회, 분실하면 업데이트 불가)

```bash
keytool -genkey -v -keystore neongem-release.keystore \
  -alias neongem -keyalg RSA -keysize 2048 -validity 10000
```

`android/app/build.gradle`의 `signingConfigs`에 키를 연결하거나,
Android Studio **Build → Generate Signed App Bundle** 마법사를 사용하세요.

```bash
cd android
./gradlew bundleRelease     # → app/build/outputs/bundle/release/app-release.aab
```

- `versionCode`/`versionName`은 `android/app/build.gradle`에서 올립니다.
- targetSdk는 Capacitor 8 기본값(35 이상)을 그대로 두세요. Play 정책상 매년 상향이 필요합니다.

---

## 4. iOS 빌드 (선택)

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

Xcode에서 **Team(서명)**, **Bundle Identifier**(`com.jupjup.neongemmerge`)를 확인하고
실기기에서 실행 → **Product → Archive → Distribute App → App Store Connect**.

- `Info.plist`에 `NSUserTrackingUsageDescription`이 필요할 수 있습니다(맞춤 광고 사용 시).
  현재 어댑터는 `requestTrackingAuthorization: false`로 시작하므로 ATT 팝업 없이 비맞춤 광고로 동작합니다.
  맞춤 광고로 수익을 높이려면 true로 바꾸고 문구를 추가하세요.
- SKAdNetwork 항목은 AdMob 문서의 최신 목록을 복사해 넣으면 설치 측정이 개선됩니다.

---

## 5. Google Play 등록

1. **Play Console → 앱 만들기**: 앱 이름 `네온 젬 머지 : 보석 합치기 퍼즐`, 기본 언어 한국어,
   앱/게임 → **게임**, 무료.
2. **앱 콘텐츠** (모두 필수, 미입력 시 검토 거부)
   - 개인정보 처리방침 URL
   - 광고 포함 → **예**
   - 콘텐츠 등급 설문 (IARC) — 폭력성/공포/도박 없음, 광고 포함 체크
   - 타깃층 및 콘텐츠 → **만 13세 이상** 권장 (아래 7장 참고)
   - 데이터 보안: "광고 ID" 수집·공유(AdMob), "기기 또는 기타 ID" — 광고 목적
   - 뉴스/정부/금융 앱 아님
3. **스토어 등록정보**
   - 앱 아이콘 512×512 PNG (32-bit, 투명 배경 없음) → `www/icons/icon-512.png`
   - 그래픽 이미지 1024×500 PNG/JPG
   - 휴대폰 스크린샷 2~8장 (권장 1080×1920 이상, 9:16)
   - 짧은 설명 80자 / 자세한 설명 4000자 (아래 예시)
4. **프로덕션 → 비공개 테스트 트랙**에 AAB 업로드.
   - 2023년 이후 만든 **개인 개발자 계정은 출시 전 12명 이상 테스터 × 14일 연속 테스트**가 필요합니다.
   - 테스터를 모집해 2주간 실제 플레이를 받은 뒤 프로덕션 출시를 신청하세요.
5. 심사 제출 → 보통 1~7일.

### 스토어 문구 예시

- **짧은 설명(80자)**: `같은 보석을 합쳐 코스믹 다이아몬드까지! 손맛 좋은 네온 젬 머지 퍼즐`
- **자세한 설명**: 게임 규칙 3줄 + 11단계 보석 소개 + 부스터/부활 설명 + "광고 포함" 고지 + 문의 메일.
  (스크린샷에 실제 플레이 화면을 쓰고, 과장·타 게임 명칭 언급은 피하세요.)

---

## 6. App Store 등록 (iOS)

1. App Store Connect → 앱 생성, 번들 ID `com.jupjup.neongemmerge`.
2. 스크린샷: 6.9인치(iPhone 16 Pro Max) 필수 + 6.5인치 권장.
3. **앱 개인정보 보호**: 광고 데이터(광고 ID), 식별자, 사용 데이터 → "앱 추적에 사용" 여부 표시.
4. 연령 등급: 4+ (광고 포함), "광고 포함" 고지.
5. 심사 노트: "광고는 보상형/배너만 사용하며, 심사용으로 모든 보상은 광고 없이도 테스트 가능합니다"
   라고 적고 테스트 계정이 필요 없음을 명시.

---

## 7. 아동·가족 정책 — 꼭 읽어 주세요

이 게임은 **아이들도 즐길 수 있는 난이도와 디자인**이지만, 스토어에서 "아동 대상"으로 신고하면
광고 정책이 크게 달라집니다.

**Google Play Families 정책 (아동 대상으로 신고한 경우)**
- 인증된 광고 SDK만 사용 + 아동 대상 광고만 송출
- 맞춤 광고·관심 기반 광고 **금지**, 광고 ID 수집 제한
- AdMob에서 `tagForChildDirectedTreatment(true)`, `maxAdContentRating('G')` 설정 필요
- 위반 시 앱 삭제/계정 정지

**Apple**: Kids 카테고리는 제3자 분석·광고에 제한이 있고, 4+ 등급에서도 광고 내용이 4+에 적합해야 합니다.

**권장 전략**
- 타깃층은 **만 13세 이상**으로 신고하고, 마케팅 문구는 "온 가족이 함께 즐기는" 수준으로 표현
  (아이들이 실제로 즐길 수 있는 난이도·디자인은 그대로 유지)
- 보상형 광고는 "광고를 봐야 보상" 구조이므로 아동 대상 앱에서는 특히 신중해야 합니다.
- 아동 대상으로 출시하려면 광고를 끄거나(부스터를 무료로 전환) Families 인증 SDK만 사용하세요.

> 부스터를 광고 없이 운영하고 싶다면 `www/js/game.js`의 `reset()`에서
> `this.boosters.bomb = 1` 숫자를 늘리면 됩니다. 광고 흐름은 `main.js`에서 분리되어 있습니다.

---

## 8. 개인정보 처리방침 초안

아래를 복사해 본인 정보로 채운 뒤 웹 페이지로 공개하고, Play Console/App Store에 URL을 등록하세요.

```
네온 젬 머지(Neon Gem Merge) 개인정보 처리방침

1. 수집하는 정보
   - 게임은 회원가입 없이 동작하며, 이름·전화번호·이메일을 수집하지 않습니다.
   - 최고 점수와 설정은 이용자 기기(localStorage)에만 저장됩니다.
   - 광고 제공을 위해 Google AdMob이 광고 ID, 기기 정보, 대략적인 위치(IP 기반) 등을 수집할 수 있습니다.

2. 광고
   - 본 앱은 Google AdMob의 배너 및 보상형 광고를 사용합니다.
   - Google의 데이터 처리 방식: https://policies.google.com/technologies/partner-sites

3. 아동
   - 본 앱은 만 13세 미만 아동을 주 대상으로 하지 않으며, 아동의 개인정보를 의도적으로 수집하지 않습니다.

4. 문의
   - 이메일: (본인 이메일)
   - 시행일: (YYYY-MM-DD)
```

영문 요약도 함께 두면 App Store 심사에 유리합니다.

---

## 9. 수익화 운영 팁

- **보상형 3개 지점**(젬 제거·젬 교체·부활)이 핵심 수익원입니다. 배너는 보조 수단으로 두세요.
- 부활 광고는 게임 오버 화면에서 가장 전환율이 높습니다. 지금처럼 **한 판 1회** 제한을 유지하세요.
- 앱 실행 직후 전면 광고는 정책·UX 모두에서 역효과입니다(현재 구현에는 없음).
- 하단 배너는 320×50 고정, 플레이 영역을 가리지 않도록 이미 여백이 확보되어 있습니다.
- `app-ads.txt`를 개발자 웹사이트 루트에 게시하면 AdMob 수익 안정성과 브랜드 보호에 도움이 됩니다.
  (AdMob → 앱 → app-ads.txt 안내에서 발급되는 한 줄을 그대로 사용)

---

## 10. 출시 전 최종 체크리스트

- [ ] `AD_IDS` 실제 ID로 교체, `isTesting: false`
- [ ] AndroidManifest `APPLICATION_ID` / Info.plist `GADApplicationIdentifier` 입력
- [ ] 실기기에서 보상형 광고 3종(젬 제거/젬 교체/부활) 실제 시청 테스트
- [ ] 배너가 하단 독을 가리지 않는지 확인 (기기 3종 이상: 소형/일반/대형)
- [ ] 오프라인 실행 확인 (비행기 모드에서 재실행)
- [ ] 개인정보 처리방침 URL 공개
- [ ] 스토어 스크린샷에 실제 플레이 화면 사용, "광고 포함" 표기
- [ ] `versionName`/`versionCode` 설정
- [ ] 서명 키 백업 (분실 시 업데이트 불가)

---

## 11. 문제 해결

| 증상 | 원인 / 해결 |
| --- | --- |
| 앱 실행 즉시 종료 | AdMob 앱 ID 미입력(AndroidManifest/Info.plist) |
| 광고가 안 나옴 | 새 광고 단위는 반영에 수 시간 걸림. `isTesting: true` 상태에서는 테스트 광고만 표시 |
| `NO_FILL` | 해당 지역/시간에 재고 없음. 정상이며 게임은 계속 동작 |
| iOS에서 광고 무음/미표시 | ATT 미요청·SKAdNetwork 누락, 또는 광고 단위 ID 오타 |
| 흰 화면 | `npx cap sync` 누락 또는 `webDir` 경로 오류 |
| 소리가 안 남 | 모바일은 첫 터치 이후 Web Audio가 활성화됩니다(정상) |
| 업데이트가 반영 안 됨 | `www/sw.js`의 `CACHE_NAME` 버전 올리기 |
