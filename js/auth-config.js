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
      },
      {
        "name": "규격 읽기",
        "desc": "「420±1」 「48 +1.0/-0.5」 「1.5 MAX」 「80㎛↑」 같은 검사표 글자에서 하한 · 상한을 읽습니다. 덮어쓰기 표는 선택."
      },
      {
        "name": "시트 풍선 체크",
        "desc": "시트 부착 체크시트는 OK 또는 「체크 수/풍선 수」로 판정합니다. 모자라면 불합격."
      }
    ],
    "steps": [
      "로그인 · 승인",
      "자료 넣기",
      "쪽마다 읽기",
      "판독",
      "호기 판정",
      "출하 대조"
    ],
    "flow": [
      {
        "step": "로그인 · 승인",
        "desc": "가입 → 사용 신청 → 관리자 승인(내 PC 는 건너뜀)"
      },
      {
        "step": "자료 넣기",
        "desc": "출하일정 엑셀(여러 파일 더하기) · 검사표 PDF 여러 개 · 폴더째"
      },
      {
        "step": "쪽마다 읽기",
        "desc": "글자 층은 칸 자리로 자동, 스캔은 그림만으로 표시 · 방향 세우기"
      },
      {
        "step": "판독",
        "desc": "수동 판독 표 또는 AI 반자동, 확신 낮은 칸은 노랑"
      },
      {
        "step": "호기 판정",
        "desc": "한 칸이라도 공차 밖이면 불합격, 빈 칸 · 못 읽은 칸은 보류"
      },
      {
        "step": "출하 대조",
        "desc": "공정별 검사표를 모아 출하 예정 호기와 짝"
      }
    ],
    "goals": [
      "출하 예정 호기마다 검사표가 있는지, 합격인지를 출하일이 가까운 순서로 보여 줍니다.",
      "스캔 검사표를 그림 옆 입력 표로 빠르게 옮기고, 적는 즉시 호기마다 합불을 판정합니다.",
      "공정별 검사표를 모두 모아 호기 하나의 판정으로 묶습니다."
    ],
    "screen": "docs/img/screen.png",
    "plan": "plan.html",
    "home": true,
    "landing": {
      "image": "images/landing.jpg",
      "imageMode": "banner",
      "imageAlt": "보이지 않던 검사 현황까지 한눈에 — AI가 검사 기록을 분석하고 제품별 검사 진행 상황을 추적합니다",
      "colors": {
        "navy": "#0d2a5c",
        "navy2": "#081d42",
        "brand": "#1a4fa0",
        "brandDark": "#123a78",
        "accent": "#ff9a8f"
      },
      "company": {
        "name": "건화",
        "en": "KUNHWA"
      }
    }
  }
};
