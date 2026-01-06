// Cafe24 상품 크롤링 서버
import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// 환경변수에서 Mall ID 가져오기
const MALL_ID = process.env.VITE_CAFE24_MALL_ID || 'cheritale25';

// HTML 페이지 가져오기
async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

// 이미지 URL 정규화
function normalizeImageUrl(src) {
  if (!src) return null;

  // 빈 이미지나 placeholder 제외
  if (src.includes('placeholder') || src.includes('noimage') || src.includes('blank') || src.includes('data:image')) {
    return null;
  }

  // 상대 경로를 절대 경로로 변환
  if (src.startsWith('//')) {
    return 'https:' + src;
  }
  if (!src.startsWith('http')) {
    return `https://${MALL_ID}.cafe24.com${src.startsWith('/') ? '' : '/'}${src}`;
  }

  return src;
}

// 상품 목록 페이지에서 상품 정보 추출
function extractProductsFromPage($, categoryInfo = {}) {
  const products = [];

  // Cafe24 일반적인 상품 목록 셀렉터들 (직접 자식 선택자 우선)
  const selectors = [
    'ul.prdList > li',
    '.prdList > li',
    '.prdList li.xans-record-',
    '.product-list > li',
    '.xans-product-listnormal > li',
    '.xans-element-.xans-product.xans-product-listnormal > li',
    '.product_list > li',
    '.item_list > li',
    '.goods_list > li',
  ];

  let productElements = null;

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      productElements = elements;
      break;
    }
  }

  if (!productElements || productElements.length === 0) {
    productElements = $('[class*="product"] li, [class*="prd"] li, [class*="item"] li').filter(function() {
      return $(this).find('a[href*="product"]').length > 0;
    });
  }

  productElements.each((_, el) => {
    try {
      const $el = $(el);

      // 상품 링크
      const link = $el.find('a[href*="product"]').first().attr('href');
      if (!link) return;

      // 상품 ID 추출
      const idMatch = link.match(/\/product\/[^/]+\/(\d+)/) || link.match(/product_no=(\d+)/) || link.match(/\/(\d+)/);
      const productId = idMatch ? idMatch[1] : null;
      if (!productId) return;

      // 상품명 추출 - 다양한 셀렉터 시도
      let name = '';

      // 1. img alt 속성에서 가져오기 (가장 정확함)
      const imgAlt = $el.find('.prdImg img').first().attr('alt');
      if (imgAlt && imgAlt.length > 0 && !imgAlt.includes('상품명')) {
        // "~ 이미지" 또는 "~ 제품 이미지" 또는 "~ - 맞춤 디자인 제품 이미지" 접미사 제거
        name = imgAlt
          .replace(/\s*-\s*맞춤\s*디자인\s*(제품\s*)?이미지$/i, '')
          .replace(/\s*(제품\s*)?이미지$/i, '')
          .trim();
      }

      // 2. .name 내 a 태그 직접 자식 span 중 마지막 것 (displaynone 클래스 부모가 아닌 것)
      if (!name || name === '상품명') {
        const nameContainer = $el.find('.description .name, .name');
        if (nameContainer.length > 0) {
          // a 태그의 직접 자식 span만 선택 (중첩된 span 제외)
          const directSpans = nameContainer.find('a > span').filter(function() {
            const className = $(this).attr('class') || '';
            // displaynone, title 클래스가 아닌 것만
            return !className.includes('displaynone') && !className.includes('title');
          });

          // 마지막 직접 자식 span의 텍스트가 상품명
          if (directSpans.length > 0) {
            const lastSpanText = directSpans.last().text().trim();
            if (lastSpanText && lastSpanText.length > 0 && lastSpanText !== '상품명') {
              name = lastSpanText;
            }
          }

          // 그래도 없으면 a 태그의 전체 텍스트에서 추출
          if (!name || name === '상품명') {
            const aText = nameContainer.find('a').first().text().trim();
            // "상품명 : 실제상품명" 형태에서 추출
            const colonMatch = aText.match(/상품명\s*[:\s]\s*(.+)/);
            if (colonMatch) {
              name = colonMatch[1].trim();
            } else if (aText && aText.length > 0 && aText !== '상품명') {
              // 상품명 레이블 제거
              name = aText.replace(/^상품명\s*/, '').trim();
            }
          }
        }
      }

      // 3. 기존 셀렉터들
      if (!name || name === '상품명') {
        const nameSelectors = ['.pname a', '.product-name a', '.prd_name', '.name a', '.tit a'];
        for (const sel of nameSelectors) {
          let text = $el.find(sel).first().text().trim();
          // "상품명 : xxx" 형태 처리
          const colonMatch = text.match(/상품명\s*[:\s]\s*(.+)/);
          if (colonMatch) {
            text = colonMatch[1].trim();
          }
          if (text && text.length > 0 && !text.includes('상품명')) {
            name = text;
            break;
          }
        }
      }

      // 4. li 요소 내의 직접적인 텍스트 노드나 strong/b 태그에서 찾기
      if (!name || name === '상품명') {
        const strongText = $el.find('strong, b').first().text().trim();
        if (strongText && strongText.length > 2 && strongText.length < 100 && !strongText.includes('상품명')) {
          name = strongText;
        }
      }

      // 상품명 정리
      name = name.replace(/^상품명\s*[:\s]\s*/, '').trim();
      // 줄바꿈 및 과도한 공백 정리
      name = name.replace(/\s+/g, ' ').trim();
      if (!name || name === '상품명' || name.length < 2) return;

      // 이미지 - 다양한 속성에서 이미지 URL 찾기
      let imageUrl = null;
      const img = $el.find('img').first();
      const imgSources = [
        img.attr('src'),
        img.attr('data-src'),
        img.attr('data-original'),
        img.attr('data-lazy'),
        img.attr('ec-data-src'),
        img.attr('data-image'),
        img.attr('data-thumb'),
        img.attr('data-zoom-image'),
      ];

      // 썸네일 이미지 div에서도 찾기
      const thumbDiv = $el.find('.thumb, .thumbnail, .prdImg, .img-wrap, [class*="thumb"]').first();
      if (thumbDiv.length) {
        const thumbImg = thumbDiv.find('img').first();
        imgSources.push(
          thumbImg.attr('src'),
          thumbImg.attr('data-src'),
          thumbImg.attr('data-original'),
        );
        // background-image 스타일에서도 찾기
        const bgStyle = thumbDiv.attr('style') || '';
        const bgMatch = bgStyle.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (bgMatch) {
          imgSources.push(bgMatch[1]);
        }
      }

      for (const src of imgSources) {
        const normalized = normalizeImageUrl(src);
        if (normalized) {
          imageUrl = normalized;
          break;
        }
      }

      // 가격
      const priceText = $el.find('.price, .prd_price, [class*="price"]').text().replace(/[^0-9,]/g, '');
      const prices = priceText.match(/[\d,]+/g) || [];
      const price = prices.length > 0 ? parseInt(prices[0].replace(/,/g, ''), 10) : 0;
      const salePrice = prices.length > 1 ? parseInt(prices[prices.length - 1].replace(/,/g, ''), 10) : undefined;

      // 상품 URL 정규화
      let productUrl = link;
      if (!productUrl.startsWith('http')) {
        productUrl = `https://${MALL_ID}.cafe24.com${productUrl.startsWith('/') ? '' : '/'}${productUrl}`;
      }

      products.push({
        id: productId,
        name,
        price: salePrice && salePrice < price ? price : price,
        salePrice: salePrice && salePrice < price ? salePrice : undefined,
        imageUrl: imageUrl || 'https://via.placeholder.com/200x200?text=No+Image',
        url: productUrl,
        category: {
          large: categoryInfo.large || '',
          medium: categoryInfo.medium || '',
          small: categoryInfo.small || '',
        },
      });
    } catch (e) {
      console.error('상품 파싱 오류:', e.message);
    }
  });

  return products;
}

// 모든 카테고리 가져오기 (계층 구조 포함)
async function getAllCategories() {
  const categories = [];

  try {
    const html = await fetchPage(`https://${MALL_ID}.cafe24.com`);
    const $ = cheerio.load(html);

    // 모든 카테고리 링크 수집
    const categoryLinks = new Map();

    $('a[href*="/product/list.html?cate_no="]').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      const match = href?.match(/cate_no=(\d+)/);
      if (!match) return;

      const id = match[1];
      const name = $a.text().trim();
      if (!name || name.length === 0) return;

      // 이미 있으면 스킵
      if (categoryLinks.has(id)) return;

      const fullUrl = href.startsWith('http') ? href : `https://${MALL_ID}.cafe24.com${href}`;

      // 부모 li의 깊이로 레벨 판단
      const $li = $a.closest('li');
      const depth = $li.parents('li').length;

      categoryLinks.set(id, {
        id,
        name,
        url: fullUrl,
        depth,
      });
    });

    // depth로 정렬하여 대분류 우선
    const sortedCategories = Array.from(categoryLinks.values()).sort((a, b) => a.depth - b.depth);

    // 대분류만 추출 (depth가 가장 작은 것들)
    const minDepth = sortedCategories.length > 0 ? sortedCategories[0].depth : 0;
    const largeCategories = sortedCategories.filter(c => c.depth === minDepth);

    return largeCategories;
  } catch (e) {
    console.error('카테고리 가져오기 오류:', e.message);
  }

  return categories;
}

// 전체 상품 수집
app.get('/api/cafe24/products', async (req, res) => {
  try {
    console.log('상품 수집 시작...');
    const allProducts = new Map();

    // 카테고리 가져오기
    const categories = await getAllCategories();
    console.log(`카테고리 ${categories.length}개 발견:`, categories.map(c => c.name).join(', '));

    // 각 카테고리별 상품 수집
    for (const category of categories) {
      try {
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 20) {
          const pageUrl = `${category.url}${category.url.includes('?') ? '&' : '?'}page=${page}`;
          console.log(`카테고리 수집 중: ${category.name} (페이지 ${page})`);

          const html = await fetchPage(pageUrl);
          const $ = cheerio.load(html);

          const categoryInfo = {
            large: category.name,
            medium: '',
            small: '',
          };

          const products = extractProductsFromPage($, categoryInfo);

          if (products.length === 0) {
            hasMore = false;
          } else {
            products.forEach(p => {
              if (allProducts.has(p.id)) {
                const existing = allProducts.get(p.id);
                if (existing.imageUrl.includes('placeholder') && !p.imageUrl.includes('placeholder')) {
                  existing.imageUrl = p.imageUrl;
                }
              } else {
                allProducts.set(p.id, p);
              }
            });
            page++;
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      } catch (e) {
        console.log(`카테고리 실패: ${category.name} - ${e.message}`);
      }
    }

    const productList = Array.from(allProducts.values());
    console.log(`총 ${productList.length}개 상품 수집 완료`);

    // 카테고리 목록도 함께 반환
    const categoryList = [...new Set(productList.map(p => p.category.large).filter(Boolean))];

    res.json({
      success: true,
      count: productList.length,
      categories: categoryList,
      products: productList,
    });
  } catch (error) {
    console.error('상품 수집 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 서버 상태 확인
app.get('/api/cafe24/status', (req, res) => {
  res.json({
    success: true,
    mallId: MALL_ID,
    message: '서버가 정상 작동 중입니다.',
  });
});

// ============================================
// 다이렉트센드 API 프록시 (CORS 우회)
// ============================================

// 다이렉트센드 이메일 발송
app.post('/api/directsend/send', async (req, res) => {
  try {
    const { userId, apiKey, subject, body, sender, senderName, recipients, replyTo, reserveDate } = req.body;

    if (!userId || !apiKey) {
      return res.status(400).json({
        status: 2,
        msg: '다이렉트센드 아이디와 API 키가 필요합니다.',
      });
    }

    if (!subject || !body || !sender || !recipients || recipients.length === 0) {
      return res.status(400).json({
        status: 1,
        msg: '필수 파라미터가 누락되었습니다. (subject, body, sender, recipients)',
      });
    }

    // 수신자 목록 형식 변환 - JSON Array 형식
    // [{"name": "홍길동", "email":"aaaa@naver.com"}]
    const receiverJson = JSON.stringify(recipients.map(r => ({
      email: r.email,
      name: r.name || ''
    })));

    // 다이렉트센드 API 호출 (치환문자 기능 사용)
    const apiUrl = 'https://directsend.co.kr/index.php/api_v2/mail_change_word';

    const formData = new URLSearchParams();
    formData.append('username', userId);
    formData.append('key', apiKey);
    formData.append('sender', sender);
    formData.append('sender_name', senderName || '');
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('receiver', receiverJson);

    if (replyTo) {
      formData.append('reply', replyTo);
    }

    if (reserveDate) {
      formData.append('reserve', reserveDate);
    }

    console.log('다이렉트센드 발송 요청:', {
      userId,
      apiKey: apiKey ? apiKey.substring(0, 3) + '***' : 'undefined',
      sender,
      senderName,
      subject,
      receiverCount: recipients.length,
    });
    console.log('FormData:', formData.toString());

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log('다이렉트센드 발송 API 응답:', responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('JSON 파싱 오류:', responseText);
      return res.json({
        status: 9,
        msg: 'API 응답 파싱 오류',
      });
    }

    // 다이렉트센드 응답 형식 통일
    res.json({
      status: result.status || 0,
      msg: result.msg || '발송 완료',
      ref_key: result.ref_key || null,
    });
  } catch (error) {
    console.error('다이렉트센드 API 오류:', error);
    res.status(500).json({
      status: 9,
      msg: `시스템 오류: ${error.message}`,
    });
  }
});

// 다이렉트센드 발송 상태 조회
app.post('/api/directsend/status', async (req, res) => {
  try {
    const { userId, apiKey, refKey } = req.body;

    if (!userId || !apiKey || !refKey) {
      return res.status(400).json({
        status: 1,
        msg: '필수 파라미터가 누락되었습니다.',
      });
    }

    const apiUrl = 'https://directsend.co.kr/index.php/api_v2/mail_result';

    const formData = new URLSearchParams();
    formData.append('user_id', userId);
    formData.append('key', apiKey);
    formData.append('ref_key', refKey);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formData.toString(),
    });

    const result = await response.json();
    res.json(result);
  } catch (error) {
    console.error('다이렉트센드 상태 조회 오류:', error);
    res.status(500).json({
      status: 9,
      msg: `시스템 오류: ${error.message}`,
    });
  }
});

// 다이렉트센드 테스트 연결
app.post('/api/directsend/test', async (req, res) => {
  try {
    const { userId, apiKey } = req.body;

    if (!userId || !apiKey) {
      return res.status(400).json({
        status: 2,
        msg: '다이렉트센드 아이디와 API 키가 필요합니다.',
      });
    }

    // 잔액 조회 API로 연결 테스트
    const apiUrl = 'https://directsend.co.kr/index.php/api_v2/point';

    const formData = new URLSearchParams();
    formData.append('user_id', userId);
    formData.append('key', apiKey);

    console.log('다이렉트센드 테스트 요청:', { userId, apiKey: apiKey.substring(0, 3) + '***' });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log('다이렉트센드 API 응답 상태:', response.status);
    console.log('다이렉트센드 API 응답:', responseText.substring(0, 500));

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON 파싱 오류');
      return res.json({
        status: 9,
        msg: 'API 응답이 JSON 형식이 아닙니다. 다이렉트센드 계정 설정을 확인해주세요.',
      });
    }

    if (result.status === 0 || result.point !== undefined) {
      res.json({
        status: 0,
        msg: '연결 성공',
        point: result.point || 0,
      });
    } else {
      res.json({
        status: result.status || 2,
        msg: result.msg || '인증 실패',
      });
    }
  } catch (error) {
    console.error('다이렉트센드 연결 테스트 오류:', error);
    res.status(500).json({
      status: 9,
      msg: `시스템 오류: ${error.message}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Cafe24 크롤링 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  console.log(`대상 쇼핑몰: https://${MALL_ID}.cafe24.com`);
});
