// 로그인 설정 — 이 파일 한 곳만 바꾸면 된다(생성: data10-00/scripts/apply-auth-kit.mjs, 대문 문구 출처 docs/plan.json).
// 내 Supabase 로 옮길 때: url · anonKey 를 내 프로젝트 값으로, 카카오를 설정하지 않았으면 kakao: false. 안내 = docs/내_깃허브로_옮기기.md
// prefix 는 supabase/auth.sql 의 표 이름 앞부분과 같아야 한다.
window.AUTH_CONFIG = {
  "url": "https://hcmgdztsgjvzcyxyayaj.supabase.co",
  "anonKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjbWdkenRzZ2p2emN5eHlheWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzU4ODcsImV4cCI6MjA4NzAxMTg4N30.gznaPzY1l8qDAPsEyYNR9KS7f7VqS3xaw-_2HTSwSZw",
  "prefix": "data1013",
  "kakao": true,
  "idleMinutes": 30,
  "localBypass": true,
  "site": {
    "title": "불량 제품 파악",
    "summary": "공유폴더의 수기 검사표 PDF를 쪽마다 판독해 검사표에 적힌 공차로 호기별 합불을 판정하고, 출하일정과 맞춰 검사표 없음 · 불합격 · 미판정 리스트를 만드는 브라우저 도구입니다.",
    "course": "현장 데이터 디지털화 전문가과정 · 2차수",
    "features": [
      {
        "name": "출하 대조",
        "desc": "출하 예정 호기마다 검사표 없음 · 불합격 · 미판정을 출하일 순으로 남은 날(D-n)과 함께 보여 줍니다."
      },
      {
        "name": "검사표 판독",
        "desc": "검사표 그림 옆 표에 값을 적으면 바로 칸 색과 호기 판정이 나옵니다. 수동 판독 · AI 반자동."
      },
      {
        "name": "공정별 · 여러 쪽 검사표",
        "desc": "한 PDF 의 쪽마다 따로 판독하고, 같은 호기의 공정별 검사표를 모두 모아 판정합니다."
      },
      {
        "name": "불합격 리스트 · 엑셀",
        "desc": "호기 · 칸 · 기준 · 적힌 값 · 문제점을 모아 엑셀 8개 시트로 내보냅니다."
      }
    ],
    "steps": [
      "로그인 · 승인",
      "자료 넣기",
      "쪽마다 읽기",
      "판독",
      "호기 판정",
      "출하 대조"
    ]
  }
};
