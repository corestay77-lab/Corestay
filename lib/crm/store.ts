import { makeStore } from "@/lib/hoteldoc";
export { resolveHotel } from "@/lib/hoteldoc";
const st = makeStore("crm_doc");
export const getDoc = st.getDoc, putDoc = st.putDoc;
