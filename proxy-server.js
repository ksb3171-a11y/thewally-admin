// 로컬 CORS 프록시 서버
// 브라우저에서 공공데이터 API 호출을 위한 프록시

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3001;

// CORS 허용 (모든 헤더 허용)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: '*',
}));

// JSON 파싱
app.use(express.json());

// 프록시 엔드포인트
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  const acceptType = req.query.accept || 'auto'; // 'json', 'html', 'auto'

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  console.log(`[프록시] 요청: ${targetUrl.slice(0, 80)}...`);

  try {
    // Accept 헤더 설정 (HTML 우선으로 변경)
    const acceptHeader = acceptType === 'json'
      ? 'application/json'
      : 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7';

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': acceptHeader,
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 30000,
    });

    const text = await response.text();
    const contentLength = text.length;

    // JSON 응답 시도
    try {
      const json = JSON.parse(text);
      console.log(`[프록시] JSON 성공 (${contentLength}자): ${JSON.stringify(json).slice(0, 80)}...`);
      res.json(json);
    } catch {
      // JSON이 아니면 HTML/텍스트로 반환
      console.log(`[프록시] HTML 성공 (${contentLength}자)`);
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.send(text);
    }
  } catch (error) {
    console.error(`[프록시] 오류: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===========================================
// 다이렉트센드 API 프록시
// ===========================================

// 다이렉트센드 이메일 발송
app.post('/api/directsend/send', async (req, res) => {
  const { userId, apiKey, subject, body, sender, senderName, recipients, replyTo, reserveDate } = req.body;

  console.log(`[다이렉트센드] 발송 요청: ${recipients?.length || 0}명`);
  console.log(`[다이렉트센드] 제목: ${subject}`);
  console.log(`[다이렉트센드] 발신자: ${sender} (${senderName})`);

  if (!userId || !apiKey) {
    return res.status(400).json({ status: 2, msg: '인증 정보가 필요합니다.' });
  }

  if (!recipients || recipients.length === 0) {
    return res.status(400).json({ status: 4, msg: '수신자가 없습니다.' });
  }

  try {
    // 다이렉트센드 API 호출 (실제 API 엔드포인트)
    // API 문서: https://directsend.co.kr/index.php/customer/manual
    const directSendUrl = 'https://directsend.co.kr/index.php/api_v2/mail_change_word';

    // 수신자 목록 포맷팅 (다이렉트센드 형식)
    const receiver = recipients.map(r => ({
      email: r.email,
      name: r.name || '',
      ...(r.replace || {}),
    }));

    // form-urlencoded 형식으로 전송 (테스트 API와 동일)
    // 다이렉트센드 API는 'subject' 파라미터명을 사용
    const formData = new URLSearchParams();
    formData.append('username', userId);
    formData.append('key', apiKey);
    formData.append('sender', sender);
    formData.append('sender_name', senderName);
    formData.append('subject', subject);  // 'title' -> 'subject'로 변경
    formData.append('body', body);
    formData.append('receiver', JSON.stringify(receiver));
    if (replyTo) formData.append('reply', replyTo);
    if (reserveDate) formData.append('reserve', reserveDate);

    const formBody = formData.toString();
    console.log(`[다이렉트센드] 요청 파라미터:`);
    console.log(`  - username: ${userId}`);
    console.log(`  - subject: ${subject}`);
    console.log(`  - sender: ${sender}`);
    console.log(`  - receiver 수: ${receiver.length}`);
    console.log(`  - receiver 데이터: ${JSON.stringify(receiver, null, 2)}`);
    console.log(`  - body 길이: ${body?.length || 0}`);
    console.log(`[다이렉트센드] 전체 form data 길이: ${formBody.length}`);
    // 처음 500자만 출력 (디버깅용)
    console.log(`[다이렉트센드] form data 시작: ${formBody.substring(0, 500)}...`);

    const response = await fetch(directSendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formBody,
    });

    const result = await response.text();
    console.log(`[다이렉트센드] 응답: ${result}`);

    // 응답 파싱 (다이렉트센드는 JSON 또는 텍스트로 응답)
    try {
      const jsonResult = JSON.parse(result);
      res.json(jsonResult);
    } catch {
      // 숫자만 응답하는 경우 (상태 코드)
      const status = parseInt(result, 10);
      if (!isNaN(status)) {
        res.json({ status, msg: status === 0 ? '발송 성공' : `오류 코드: ${status}` });
      } else {
        res.json({ status: -1, msg: result });
      }
    }
  } catch (error) {
    console.error(`[다이렉트센드] 오류: ${error.message}`);
    res.status(500).json({ status: 9, msg: error.message });
  }
});

// 다이렉트센드 연결 테스트 및 잔액 조회
app.post('/api/directsend/test', async (req, res) => {
  const { userId, apiKey } = req.body;

  console.log(`[다이렉트센드] 연결 테스트: ${userId}`);

  if (!userId || !apiKey) {
    return res.status(400).json({ status: 2, msg: '인증 정보가 필요합니다.' });
  }

  try {
    // 잔액 조회 API로 연결 테스트
    const testUrl = 'https://directsend.co.kr/index.php/api_v2/point';

    const formData = new URLSearchParams();
    formData.append('username', userId);
    formData.append('key', apiKey);

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formData.toString(),
    });

    const result = await response.text();
    console.log(`[다이렉트센드] 테스트 응답: ${result}`);

    try {
      const jsonResult = JSON.parse(result);
      res.json(jsonResult);
    } catch {
      const point = parseInt(result, 10);
      if (!isNaN(point) && point >= 0) {
        res.json({ status: 0, point, msg: '연결 성공' });
      } else {
        res.json({ status: 2, msg: '인증 실패' });
      }
    }
  } catch (error) {
    console.error(`[다이렉트센드] 테스트 오류: ${error.message}`);
    res.status(500).json({ status: 9, msg: error.message });
  }
});

// 다이렉트센드 잔액(포인트) 조회
// 주의: 다이렉트센드 공식 API 문서에 잔액 조회 API가 없음
// 웹사이트 대시보드에서 확인 권장
app.post('/api/directsend/balance', async (req, res) => {
  // API 미지원 - 대시보드 안내
  res.json({
    status: -1,
    msg: '잔액 조회 API가 지원되지 않습니다. 다이렉트센드 대시보드에서 확인해주세요.',
    dashboard_url: 'https://directsend.co.kr'
  });
});

// 다이렉트센드 발송 결과 조회 (메일)
// 주의: 다이렉트센드 공식 API 문서에 발송 결과 조회 API가 없음
// Return URL 설정 또는 웹사이트 대시보드에서 확인 권장
app.post('/api/directsend/result', async (req, res) => {
  // API 미지원 - 대시보드 안내
  res.json({
    status: -1,
    msg: '발송 결과 조회 API가 지원되지 않습니다. 다이렉트센드 대시보드에서 확인해주세요.',
    dashboard_url: 'https://directsend.co.kr'
  });
});

// ===========================================
// 수신거부 페이지 (HTML 렌더링)
// ===========================================

// 수신거부 확인 페이지
app.get('/unsubscribe', (req, res) => {
  const email = req.query.email || '';
  const name = req.query.name || '';

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Re:365 광고성 정보 메일 수신 거절 신청</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Malgun Gothic', sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 450px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: #f8f9fa;
      padding: 20px;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header h1 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      color: #666;
      cursor: pointer;
    }
    .content {
      padding: 30px 20px;
      text-align: center;
    }
    .name {
      color: #333;
      margin-bottom: 15px;
    }
    .question {
      font-size: 15px;
      color: #333;
      margin-bottom: 10px;
    }
    .email {
      font-size: 14px;
      color: #666;
      margin-bottom: 25px;
    }
    .buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
    }
    .btn {
      padding: 12px 40px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #ec4899;
      color: white;
    }
    .btn-primary:hover {
      background: #db2777;
    }
    .btn-secondary {
      background: #e5e7eb;
      color: #374151;
    }
    .btn-secondary:hover {
      background: #d1d5db;
    }
    .notice {
      padding: 15px 20px;
      background: #f9fafb;
      border-top: 1px solid #e9ecef;
      font-size: 12px;
      color: #666;
      line-height: 1.5;
    }
    .result {
      display: none;
      padding: 30px 20px;
      text-align: center;
    }
    .result.show {
      display: block;
    }
    .result-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    .result-message {
      font-size: 16px;
      color: #333;
      margin-bottom: 10px;
    }
    .result-sub {
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Re:365 광고성 정보 메일 수신 거절 신청</h1>
      <button class="close-btn" onclick="window.close()">&times;</button>
    </div>
    <div class="content" id="confirmContent">
      <p class="name">${name ? name + '님' : ''}</p>
      <p class="question"><strong>Re:365 광고성 정보 메일</strong> 수신을 거절 하시겠습니까?</p>
      <p class="email">메일 주소 : <strong>${email ? email.replace(/^(.{3})(.*)(@.*)$/, '$1****$3') : ''}</strong></p>
      <div class="buttons">
        <button class="btn btn-primary" onclick="processUnsubscribe()">수신 거절</button>
        <button class="btn btn-secondary" onclick="window.close()">닫기</button>
      </div>
    </div>
    <div class="result" id="resultContent">
      <div class="result-icon" id="resultIcon">✅</div>
      <p class="result-message" id="resultMessage">수신거부 처리가 완료되었습니다.</p>
      <p class="result-sub" id="resultSub">더 이상 광고성 메일을 받지 않습니다.</p>
    </div>
    <div class="notice">
      · 광고성 정보 메일 수신을 거절하시면, Re:365에서 제공하는 행사 및 할인 정보가 제공되지 않습니다.
    </div>
  </div>

  <script>
    function processUnsubscribe() {
      const email = '${email}';
      if (!email) {
        alert('이메일 정보가 없습니다.');
        return;
      }

      fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      })
      .then(res => res.json())
      .then(data => {
        document.getElementById('confirmContent').style.display = 'none';
        const resultContent = document.getElementById('resultContent');
        resultContent.classList.add('show');

        if (data.success) {
          document.getElementById('resultIcon').textContent = '✅';
          document.getElementById('resultMessage').textContent = '수신거부 처리가 완료되었습니다.';
          document.getElementById('resultSub').textContent = '더 이상 광고성 메일을 받지 않습니다.';
        } else {
          document.getElementById('resultIcon').textContent = 'ℹ️';
          document.getElementById('resultMessage').textContent = data.message || '처리 중 오류가 발생했습니다.';
          document.getElementById('resultSub').textContent = '';
        }
      })
      .catch(err => {
        alert('오류가 발생했습니다: ' + err.message);
      });
    }
  </script>
</body>
</html>
  `;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 수신거부 로그 저장 (파일 기반)
const UNSUBSCRIBE_LOG_FILE = './unsubscribe_log.json';

// 수신거부 로그 읽기
const readUnsubscribeLog = () => {
  try {
    if (fs.existsSync(UNSUBSCRIBE_LOG_FILE)) {
      const data = fs.readFileSync(UNSUBSCRIBE_LOG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('[수신거부] 로그 읽기 오류:', e.message);
  }
  return { unsubscribed: [] };
};

// 수신거부 로그 저장
const saveUnsubscribeLog = (log) => {
  try {
    fs.writeFileSync(UNSUBSCRIBE_LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
  } catch (e) {
    console.error('[수신거부] 로그 저장 오류:', e.message);
  }
};

// 수신거부 API
app.post('/api/unsubscribe', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: '이메일이 필요합니다.' });
  }

  console.log(`[수신거부] 요청: ${email}`);

  // 수신거부 로그에 저장
  const log = readUnsubscribeLog();
  const existingIndex = log.unsubscribed.findIndex(
    item => item.email.toLowerCase() === email.toLowerCase()
  );

  if (existingIndex >= 0) {
    return res.json({
      success: false,
      email: email,
      message: '이미 수신거부 처리되었습니다.'
    });
  }

  log.unsubscribed.push({
    email: email,
    timestamp: new Date().toISOString()
  });
  saveUnsubscribeLog(log);

  console.log(`[수신거부] 완료: ${email}`);

  res.json({
    success: true,
    email: email,
    message: '수신거부 처리되었습니다.',
    timestamp: new Date().toISOString()
  });
});

// 수신거부 목록 조회 API
app.get('/api/unsubscribe/list', (req, res) => {
  const log = readUnsubscribeLog();
  res.json(log);
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  CORS 프록시 서버 실행 중`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`사용법: http://localhost:${PORT}/proxy?url=<인코딩된URL>`);
  console.log(`헬스체크: http://localhost:${PORT}/health`);
  console.log(`수신거부: http://localhost:${PORT}/unsubscribe?email=test@example.com\n`);
});
