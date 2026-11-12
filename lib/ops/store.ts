import { makeStore } from "@/lib/hoteldoc";
export { resolveHotel } from "@/lib/hoteldoc";
export type { H } from "@/lib/hoteldoc";
const st = makeStore("ops_doc");
export const getDoc = st.getDoc, putDoc = st.putDoc;
