import Script from "next/script";

// 첫 화면 이미지와 대역폭을 다투지 않게 페이지 로드가 끝난 뒤 불러온다
export const GoogleAnalytics = ({ gaId }: { gaId: string }) => (
  <>
    <Script id="ga-init" strategy="lazyOnload">
      {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
    </Script>
    <Script
      id="ga"
      src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      strategy="lazyOnload"
    />
  </>
);
