# 패션쇼 모바일 초대장

저장소: https://github.com/gxonu/fashion-show-invitation

GitHub Pages 미리보기: https://gxonu.github.io/fashion-show-invitation/

새 디자인 목업: https://gxonu.github.io/fashion-show-invitation/mockup/

참고 사이트: https://incredible-cranachan-c3d6c5.netlify.app/

원본의 공개 HTML·CSS·JavaScript와 이미지로 화면을 동일하게 재현한 정적 웹사이트입니다.
현재 원본 행사명·일정·작품 설명·이미지는 그대로이며, 원본 참석자 명단은 가져오지 않았습니다.
실제 명단 대신 가상 테스트 데이터만 들어 있습니다. 코드는 공개 저장소로 관리하며, 원본 디자인과 가상 데이터의 미리보기를 GitHub Pages에 배포합니다.

## 실행

Python 3만 필요하며 npm 설치나 프레임워크 빌드는 필요하지 않습니다.

```bash
cd /home/nas5/kinamkim/Repos/geonwoo/fashion-show-invitation
python3 scripts/build.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

브라우저에서 http://localhost:4173 접속.
SSH 원격 서버라면 위 실행 명령을 서버에서 수행하고, 개인 PC의 별도 터미널에서 다음 명령을 실행합니다.
`USER@SERVER`는 실제 SSH 접속 계정·주소로 바꾸세요.

```bash
ssh -L 4173:127.0.0.1:4173 USER@SERVER
```

그다음 개인 PC 브라우저에서 http://localhost:4173 을 엽니다.
HTML 파일을 직접 더블클릭하면 CSV 조회가 브라우저 보안 정책으로 작동하지 않을 수 있습니다.
원본 파일 수정 후에는 build.py를 다시 실행하세요.

## 테스트 좌석

| 전화번호 | 결과 |
|---|---|
| 01000000001 | A01 / 테스트 일반 |
| 01000000002 | V01 / 테스트 VIP |
| 01000000003 | B01 · B02 · B03 / 테스트 동반 |
| 01000000099 | 등록된 좌석 없음 |

입장 확인은 원본과 같이 2026-08-08 17:00 한국 시간부터 가능합니다.
입장 상태는 현재 화면에서만 바뀌며 새로고침하면 초기화됩니다.
서버 저장, 직원 인증, 중복 입장 방지, 결제, 예매 기능은 없습니다.

## 파일 구성과 디자인 교체

- `index.html`: 행사명·날짜·장소·프로그램·53개 Look·전시·단체·교통 안내
- `styles.css`: 모바일 배치·색상·폰트·티켓 애니메이션
- `script.js`: 화면 전환·좌석 조회·입장 버튼 시간 (`ENTRY_OPEN_AT`)
- `assets/`: 디자인 이미지. 주요 파일은 아래 표 참고
- `seats.csv`: 브라우저에서 읽는 좌석 명단 (현재 가상 데이터)
- `examples/demo-guests.csv`: 명단 입력 형식 예제 (가상 데이터)
- `scripts/prepare_seats.py`: 전화번호를 해시 처리하고 CSV 검증
- `scripts/build.py`: 공개할 파일만 `dist/`에 복사
- `scripts/deploy_pages.py`: 공개 파일만 gh-pages 브랜치로 배포 (Git 인증 필요)
- `netlify.toml`: Netlify 자동 빌드·배포 설정
- `reference-assets.json`: 참고 이미지 출처와 파일 검증 정보

| 디자인 소재 | 파일 |
|---|---|
| 메인 배경 | `assets/main-background.jpg` |
| 행사 로고 | `assets/interview.png` |
| 메인 티켓 버튼 | `assets/IMG_5390.PNG` |
| 하단 테이프 | `assets/IMG_5423.PNG` |
| 안내 폴더 | `assets/folder.png` |
| 티켓 봉투 | `assets/ticket-folder.jpg` |
| 전시 포스터 | `assets/exhibition-poster.png` |
| 단체 사진·로고 | `assets/about-off-photo.png`, `assets/off-logo-black.png` |
| 주차 안내 지도 | `assets/parking-map.png` |

새 이미지는 원본과 비슷한 비율·투명 여백으로 교체해야 동일한 배치가 유지됩니다.
파일명이나 비율이 달라지면 HTML·CSS 참조도 수정하세요.
행사 날짜는 HTML의 표시 문구와 script.js의 입장 시작 시각을 모두 변경해야 합니다.

## 실제 명단 교체

1. `private/` 폴더에 원본 명단을 둡니다. 이 폴더는 Git 제외 대상이며 배포에 포함되지 않습니다.
2. UTF-8 CSV의 열 이름은 `phone,seat,name,vip`로 작성합니다. `name`과 `vip`는 생략 가능하고, VIP는 `vip`로 표기합니다.
3. 전화번호 열은 엑셀에서 텍스트로 지정해 앞의 0이 없어지지 않게 합니다.
4. 한 전화번호로 여러 좌석을 연결하려면 행을 추가합니다. 같은 좌석의 중복 배정은 오류로 처리됩니다.

```bash
python3 scripts/prepare_seats.py private/guests.csv
python3 scripts/build.py
```

공개되는 seats.csv에는 전화번호 원문 대신 SHA-256 해시가 들어갑니다.
이것은 접근 제한이나 암호화된 비공개 명단이 아닙니다. 좌석·이름·해시가 브라우저에 전달됩니다.
이름이 불필요하면 name을 비워 두세요. 명단 비공개가 필요하면 서버 조회 방식으로 변경해야 합니다.
현재 원본과 같은 서비스 워커가 명단도 캐시하므로, 배포를 종료해도 기존 방문자 기기의 캐시까지 원격 삭제되지는 않습니다.

## 배포

### GitHub Pages

공개 미리보기 주소: https://gxonu.github.io/fashion-show-invitation/

`main`은 원본 코드, `gh-pages`는 공개 웹사이트 파일만 관리합니다.
GitHub Pages의 배포 소스는 `gh-pages` 브랜치의 루트(`/`)입니다.
소스 수정 후 main에 커밋·푸시하고 다음 명령으로 사이트를 갱신합니다.

```bash
python3 scripts/deploy_pages.py
```

현재 구성은 main 푸시만으로 사이트가 자동 갱신되지 않습니다. 위 배포 명령이 필요합니다.
이 명령은 기존 Git 인증을 사용합니다. PAT를 코드·README·명령 인수에 넣지 마세요.
GitHub Pages 배포가 완료되기까지 잠시 시간이 걸릴 수 있습니다.
별도 서버 운영이나 도메인 구매 없이 휴대폰과 PC에서 공개 주소로 접속할 수 있습니다.
원격 개발 서버를 종료해도 GitHub Pages는 계속 호스팅합니다.

### Netlify로 옮기는 경우

수동 배포: `python3 scripts/build.py` 실행 후 **dist 폴더만** Netlify에 업로드합니다.
Git 연동: 이 폴더를 프로젝트의 기준 폴더로 설정하면 netlify.toml의 명령으로 빌드합니다.
Netlify에서 사이트를 공개한 뒤 제공하는 `이름.netlify.app` 주소로 공유하면 됩니다.
별도 도메인은 필수가 아닙니다.
원본 명단을 포함한 프로젝트 전체를 업로드하지 마세요. 공개 파일만 dist에 생성됩니다.

원본 서비스 워커 캐시를 유지합니다. 배포 내용을 변경할 때 service-worker.js의 CACHE_NAME을 올리고
index.html의 styles.css/script.js 버전도 갱신하세요. 로컬 개발 중 이전 화면이 보이면
브라우저 개발자 도구에서 서비스 워커 등록 해제 및 사이트 데이터 삭제 후 새로고침합니다.

공개 전에는 제공받은 새 디자인·행사 콘텐츠·실제 명단으로 교체하고 행사 시작 시각을 확인하세요.

## 검증 결과

로컬 Chromium에서 일반·VIP·동반 좌석 조회, 잘못된 번호 처리, 5개 안내 탭, 모달 닫기,
320/390/430/1280px 화면, 새로고침 시 입장 상태 초기화 등 27개 검증이 통과했습니다.
명단 변환의 입력 오류 거부와 공개 파일만 배포되는 것도 확인했습니다.
상세 결과는 `verification.json`에 있습니다. 화면 캡처는 로컬 `previews/`에만 보관하며 Git과 배포에서 제외합니다.
검증 서버에는 한글 폰트가 없어 캡처의 한글이 네모로 보일 수 있습니다.
사이트는 원본과 동일하게 방문자 기기의 시스템 폰트를 사용합니다.

## 디자인 목업 02

`mockup/`에 기존 사이트와 별도의 패션 매거진 스타일 시안을 추가했습니다.
아이보리·버건디 색상, 큰 타이포, 직접 생성한 화보와 패브릭 이미지를 사용합니다.
모바일/PC 반응형, 티켓 팝업, 일반·VIP·동반 좌석 조회, 53개 Look 검색·상세 보기, 행사 안내가 동작합니다.
기존 시안의 화면과 이미지는 유지합니다. 목업도 공통 테스트 명단 `seats.csv`를 사용합니다.
이미지는 built-in image_gen으로 생성했으며 자산은 `mockup/assets/`, 전체 프롬프트는 `mockup/image-prompts.json`에 보관합니다.
