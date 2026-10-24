/**
 * «Як приймати Лірику?»: a feminine name in -а/-я takes -у/-ю after a verb.
 * Other names read the same in the accusative («Нурофен», «Omega-3»), so this
 * one ending rule covers what a medicine name needs.
 */
export function accusativeUk(name: string): string {
  const swap: Record<string, string> = { а: 'у', я: 'ю', А: 'У', Я: 'Ю' };
  const last = name.slice(-1);
  return swap[last] ? name.slice(0, -1) + swap[last] : name;
}
