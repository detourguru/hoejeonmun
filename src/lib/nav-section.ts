// 경로가 긴 쪽부터 봐야 /mypage/shows 하위 화면이 /mypage 로 잡히지 않는다
export const findNavSection = (pathname: string, sections: string[]) =>
  [...sections]
    .sort((a, b) => b.length - a.length)
    .find((href) => pathname === href || pathname.startsWith(`${href}/`));
