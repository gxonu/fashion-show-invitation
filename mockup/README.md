# INTER-VIEW · 디자인 목업 02

아이보리 종이와 버건디 포인트, 큰 타이포, 패션 화보를 사용하는 별도 디자인 시안입니다.
공개 미리보기: https://gxonu.github.io/fashion-show-invitation/mockup/

- 원본 사이트: 상위 폴더의 index.html과 assets를 그대로 유지합니다.
- 목업: 이 폴더에서 독립적인 HTML·CSS·JavaScript로 관리합니다.
- 공통 데이터: ../seats.csv의 가상 명단을 사용합니다. 테스트 번호 01000000001, 01000000002, 01000000003.
- 런웨이: 원본의 53개 Look 텍스트를 looks.js에 정리했습니다. 검색·더보기·상세 펼치기를 지원합니다.
- 티켓: 전화번호 조회, 일반/VIP/동반 좌석 표시. 실제 입장 기록은 저장하지 않습니다.
- 생성 이미지: assets/editorial-hero.png, assets/textile-study.png.
- 생성 방식: built-in image_gen. 전체 생성 프롬프트는 image-prompts.json에 있습니다.
- 화보와 패브릭 이미지는 실제 출품작이 아닌 디자인 시안용 AI 생성 이미지입니다.

프로젝트 루트에서 python3 scripts/build.py 실행 후 dist를 서빙하거나 기존 deploy_pages.py로 배포합니다.
