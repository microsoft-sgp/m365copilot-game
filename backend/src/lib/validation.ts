const LINE_KW_RE = /^CO-[A-Z0-9]+-\d{3}-(R[1-3]|C[1-3]|D[12]|FB)-[A-Z0-9]+$/;
const WEEK_KW_RE = /^CO-[A-Z0-9]+-W[1-7]-\d{3}-[A-Z0-9]+$/;

export function validateKeywordFormat(kw: string): boolean {
  return LINE_KW_RE.test(kw) || WEEK_KW_RE.test(kw);
}
