export type AccountValue = { actual: string; budget: string; lastYear: string; ytdActual: string; ytdBudget: string; lastYearYtd: string };
export type AccountGroup =
  | "roomRevenue" | "fbRevenue" | "otherRevenue" | "costOfSales" | "payroll"
  | "operatingExpenses" | "overhead" | "otherIncome" | "otherExpenses"
  | "operatorFees" | "provisions" | "depreciation" | "amortization" | "interest" | "tax" | "ownerCashItems" | "ownerShareProfit";
export type AccountLine = { code: string; label: string; group: AccountGroup; section: string; allowNegative?: boolean };
export const ACCOUNT_LINES: AccountLine[] = [
  {code:"41101",label:"Room Revenue",group:"roomRevenue",section:"Revenue"},
  {code:"41201",label:"Restaurant & Bar",group:"fbRevenue",section:"Revenue"},
  {code:"41202",label:"Bar & Lounge",group:"fbRevenue",section:"Revenue"},
  {code:"41203",label:"Banquet & Meeting Package — Food",group:"fbRevenue",section:"Revenue"},
  {code:"41204",label:"Banquet & Meeting Package — Beverage",group:"fbRevenue",section:"Revenue"},
  {code:"41205",label:"Banquet & Meeting Package — Other",group:"fbRevenue",section:"Revenue"},
  {code:"41206",label:"F&B Discounts / Allowances",group:"fbRevenue",section:"Revenue",allowNegative:true},
  {code:"41207",label:"Banquet / Wedding Event",group:"fbRevenue",section:"Revenue"},
  {code:"41208",label:"Room Service",group:"fbRevenue",section:"Revenue"},
  {code:"41209",label:"Other F&B",group:"fbRevenue",section:"Revenue"},
  {code:"41301",label:"Business Center",group:"otherRevenue",section:"Revenue"},
  {code:"41302",label:"Transportation",group:"otherRevenue",section:"Revenue"},
  {code:"41303",label:"Laundry",group:"otherRevenue",section:"Revenue"},
  {code:"41304",label:"Spa",group:"otherRevenue",section:"Revenue"},
  {code:"41305",label:"Telephone",group:"otherRevenue",section:"Revenue"},
  {code:"41306",label:"Sport & Recreation",group:"otherRevenue",section:"Revenue"},
  {code:"41307",label:"Rented Space",group:"otherRevenue",section:"Revenue"},
  {code:"41308",label:"Miscellaneous Other Revenue",group:"otherRevenue",section:"Revenue"},
  {code:"41309",label:"Other Revenue Discounts / Allowances",group:"otherRevenue",section:"Revenue",allowNegative:true},
  {code:"51101",label:"F&B Cost of Sales",group:"costOfSales",section:"Cost of Sales"},
  {code:"51201",label:"Other Department Cost of Sales",group:"costOfSales",section:"Cost of Sales"},
  ...["Front Office","Housekeeping","Food & Beverage","Engineering","Sales & Marketing","Administrative & General"].flatMap((department,di)=>
    ["Salary & Wages","Overtime","THR","Bonus / Incentive","Income Tax Allowance","Meal Allowance","Jamsostek / BPJS","Medical & Insurance","Pension","Temporary Staff","Employee Benefits","Other Payroll"].map((item,i)=>({
      code:"6"+String(di+1).padStart(2,"0")+String(i+1).padStart(2,"0"),
      label:department+" — "+item,group:"payroll" as const,section:"Payroll & Related Expenses"
    }))
  ),
  // Dedicated HRD and Minor Operating Department payroll accounts; existing codes remain unchanged.
  // Explicit employer-paid contribution accounts; employee deductions stay separate.
  {code:"60901",label:"BPJS Kesehatan — Employer Contribution",group:"payroll",section:"Payroll & Related Expenses"},
  {code:"60902",label:"JP (Jaminan Pensiun) — Employer Contribution",group:"payroll",section:"Payroll & Related Expenses"},
  ...["Human Resources","Minor Operating Dept."].flatMap((department,di)=>
    ["Salary & Wages","Overtime","THR","Bonus / Incentive","Income Tax Allowance","Meal Allowance","Jamsostek / BPJS","Medical & Insurance","Pension","Temporary Staff","Employee Benefits","Other Payroll"].map((item,i)=>({
      code:"6"+String(di+7).padStart(2,"0")+String(i+1).padStart(2,"0"),
      label:department+" — "+item,group:"payroll" as const,section:"Payroll & Related Expenses"
    }))
  ),
  ...[
    ["Room Department","Cleaning Supplies"],["Room Department","Guest Supplies"],["Room Department","Laundry & Linen"],["Room Department","Commissions"],["Room Department","Other Room Expenses"],
    ["F&B Department","Kitchen Supplies"],["F&B Department","Crockery & Cutlery"],["F&B Department","Cleaning Supplies"],["F&B Department","Music & Entertainment"],["F&B Department","Other F&B Expenses"],
    ["Other Departments","Operating Supplies"],["Other Departments","Commissions"],["Other Departments","Other Department Expenses"],
    ["Engineering","Repairs & Maintenance"],["Engineering","Tools & Supplies"],["Engineering","Contract Services"],
    ["Energy Cost","Electricity"],["Energy Cost","Water"],["Energy Cost","Gas & Fuel"],["Energy Cost","Other Utilities"],
    ["Sales & Marketing","Advertising & Promotion"],["Sales & Marketing","Travel & Entertainment"],["Sales & Marketing","Online Travel Agency Fees"],["Sales & Marketing","Other S&M Expenses"],
    ["Administrative & General","Office Supplies"],["Administrative & General","IT & Software"],["Administrative & General","Licenses & Permits"],["Administrative & General","Professional Fees"],["Administrative & General","Security"],["Administrative & General","Bank & Credit Card Charges"],["Administrative & General","Bad Debt / Provision"],["Administrative & General","Other A&G Expenses"],
    ["Human Resources","Employee Relations"],["Human Resources","Training & Education"],["Human Resources","Recruitment & Advertisement"],["Human Resources","Staff Welfare / Social Activities"],["Human Resources","Uniform & Laundry"],["Human Resources","Medical Expenses"],["Human Resources","Transportation"],["Human Resources","Printing & Stationery"],["Human Resources","Other HR Expenses"]
  ].map(([dept,item],i)=>({code:"7"+String(i+1).padStart(3,"0"),label:dept+" — "+item,group:dept==="Engineering"||dept==="Energy Cost"||dept==="Sales & Marketing"||dept==="Administrative & General"||dept==="Human Resources"?"overhead" as const:"operatingExpenses" as const,section:dept==="Room Department"||dept==="F&B Department"||dept==="Other Departments"?"Departmental Operating Expenses":"Undistributed / Overhead Expenses"})),
  {code:"80101",label:"Gain/Loss on Disposal Asset",group:"otherIncome",section:"Other Income"},
  {code:"80102",label:"Deferred Tax",group:"otherIncome",section:"Other Income"},
  {code:"80103",label:"Interest Income",group:"otherIncome",section:"Other Income"},
  {code:"80104",label:"Exchange Rates",group:"otherIncome",section:"Other Income"},
  {code:"80105",label:"Other - Other Income",group:"otherIncome",section:"Other Income"},
  {code:"80201",label:"Loss and Breakage",group:"otherExpenses",section:"Other Expense"},
  {code:"80202",label:"Owners Expenses",group:"otherExpenses",section:"Other Expense"},
  {code:"80203",label:"Property Insurance",group:"otherExpenses",section:"Other Expense"},
  {code:"80204",label:"Property Tax",group:"otherExpenses",section:"Other Expense"},
  {code:"80205",label:"Property Rent / Land Assessment",group:"otherExpenses",section:"Other Expense"},
  {code:"80206",label:"Project & Building Renovation",group:"otherExpenses",section:"Other Expense"},
  {code:"80207",label:"Consultant Fee",group:"otherExpenses",section:"Other Expense"},
  {code:"80208",label:"Other - Other Expense",group:"otherExpenses",section:"Other Expense"},
  {code:"80301",label:"Management Fee",group:"operatorFees",section:"Operator Fee"},
  {code:"80302",label:"Marketing Fee",group:"operatorFees",section:"Operator Fee"},
  {code:"80303",label:"Royalty Fee",group:"operatorFees",section:"Operator Fee"},
  {code:"80401",label:"Provision for THR",group:"provisions",section:"Other Provision"},
  {code:"80402",label:"Provision for Bonus",group:"provisions",section:"Other Provision"},
  {code:"80403",label:"Provision for Replacement FFE",group:"provisions",section:"Other Provision"},
  {code:"80501",label:"Depreciation of Building*",group:"depreciation",section:"Depreciation Expenses"},
  {code:"80502",label:"Depreciation of Equipment",group:"depreciation",section:"Depreciation Expenses"},
  {code:"80503",label:"Depreciation of Vehicle*",group:"depreciation",section:"Depreciation Expenses"},
  {code:"80504",label:"Depreciation of Fixed Asset Leased",group:"depreciation",section:"Depreciation Expenses"},
  {code:"80505",label:"Depreciation of General Building System",group:"depreciation",section:"Depreciation Expenses"},
  {code:"80506",label:"Depreciation of Machine",group:"depreciation",section:"Depreciation Expenses"},
  {code:"80507",label:"Depreciation of Furniture & Fixture",group:"depreciation",section:"Depreciation Expenses"},
  {code:"80601",label:"Amortization of Intangible Asset",group:"amortization",section:"Amortization Expenses"},
  {code:"80602",label:"Amortization of Other Asset",group:"amortization",section:"Amortization Expenses"},
  {code:"80603",label:"Amortization of Pre-Opening Expenses",group:"amortization",section:"Amortization Expenses"},
  {code:"80604",label:"Amortization SOFTWARE",group:"amortization",section:"Amortization Expenses"},
  {code:"80701",label:"Interest Bank Loan (IDR)",group:"interest",section:"Interest Expense"},
  {code:"80702",label:"Interest Bank Loan (IDR) - Provision Cost",group:"interest",section:"Interest Expense"},
  {code:"80703",label:"Interest Expense - Leased Assets",group:"interest",section:"Interest Expense"},
  {code:"80801",label:"Income Taxes",group:"tax",section:"Income Taxes"},
  {code:"80901",label:"Capital Expenditure (cash movement; outside P&L)",group:"ownerCashItems",section:"Owner Cash Flow (di luar P&L)"},
  {code:"80902",label:"FF&E Replacement Cash Payment",group:"ownerCashItems",section:"Owner Cash Flow (di luar P&L)"},
  {code:"80903",label:"Other Owner Cash Payment",group:"ownerCashItems",section:"Owner Cash Flow (di luar P&L)"},
  // Separate editable reporting line; deliberately excluded from expense aggregation.
  {code:"81001",label:"OWNER SHARE PROFIT (OSP)",group:"ownerShareProfit",section:"OTHER INCOME & EXPENSES — OWNER SHARE PROFIT"}
];
export const GROUP_LABELS: Record<AccountGroup,string> = {
  roomRevenue:"Room Revenue",fbRevenue:"F&B Revenue",otherRevenue:"Other Operating Revenue",
  costOfSales:"Cost of Sales",payroll:"Payroll & Related Expenses",
  operatingExpenses:"Other Departmental Operating Expenses",overhead:"Undistributed / Overhead Expenses",
  otherIncome:"Other Income",otherExpenses:"Other Expenses",operatorFees:"Operator Fees",ownerShareProfit:"OTHER INCOME & EXPENSES — OWNER SHARE PROFIT",
  provisions:"Provisions",depreciation:"Depreciation",amortization:"Amortization",interest:"Interest / Finance Cost",tax:"Income Tax",ownerCashItems:"Owner Cash Items (outside P&L)"
};
export const GROUP_ORDER: AccountGroup[] = ["roomRevenue","fbRevenue","otherRevenue","costOfSales","payroll","operatingExpenses","overhead","otherIncome","otherExpenses","operatorFees","provisions","depreciation","amortization","interest","tax","ownerCashItems","ownerShareProfit"];
export const ACCOUNT_SECTIONS = [...new Set(ACCOUNT_LINES.map(x=>x.section))];
export const emptyAccounts = (): Record<string,AccountValue> => Object.fromEntries(ACCOUNT_LINES.map(x=>[x.code,{actual:"",budget:"",lastYear:"",ytdActual:"",ytdBudget:"",lastYearYtd:""}]));
export const numeric = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};
export const sumGroup = (accounts: Record<string,AccountValue>, group: AccountGroup, column: keyof AccountValue, customLines: AccountLine[] = []): number | null => {
  const lines=(customLines.length?customLines:ACCOUNT_LINES).filter(x=>x.group===group);
  const present=lines.map(x=>numeric(accounts?.[x.code]?.[column])).filter((x):x is number=>x!==null);
  return present.length ? present.reduce((a,b)=>a+b,0) : null;
};
export const calculateBudget = (form: any) => {
  const days=numeric(form?.statistics?.days), rooms=numeric(form?.statistics?.rooms);
  const totalRoomBuild=days!==null&&rooms!==null?days*rooms:null;
  const outInventory=numeric(form?.statistics?.outInventory), houseUse=numeric(form?.statistics?.houseUse), outOfOrder=numeric(form?.statistics?.outOfOrder);
  const deductionsComplete=outInventory!==null&&houseUse!==null&&outOfOrder!==null;
  const roomAvailable=totalRoomBuild===null||!deductionsComplete?null:totalRoomBuild-outInventory-houseUse-outOfOrder;
  const complimentary=numeric(form?.statistics?.complimentary), paid=numeric(form?.statistics?.roomPaid);
  const occupied=complimentary!==null&&paid!==null?complimentary+paid:null;
  const customLines: AccountLine[] = Array.isArray(form?.accountLines) ? form.accountLines : [...ACCOUNT_LINES,...(Array.isArray(form?.customAccounts)?form.customAccounts:[])];
  const roomRevenue=sumGroup(form?.accounts||{},"roomRevenue","actual",customLines);
  const revenueGroups=["roomRevenue","fbRevenue","otherRevenue"] as const;
  const revenueValues=revenueGroups.map(g=>sumGroup(form?.accounts||{},g,"actual",customLines));
  const revenue=revenueValues.some(v=>v!==null)?revenueValues.reduce<number>((s,v)=>s+(v??0),0):null;
  const costGroups=["costOfSales","payroll","operatingExpenses","overhead"] as const;
  const costValues=costGroups.map(g=>sumGroup(form?.accounts||{},g,"actual",customLines));
  const costs=costValues.some(v=>v!==null)?costValues.reduce<number>((s,v)=>s+(v??0),0):null;
  const ytdRevenueValues=revenueGroups.map(g=>sumGroup(form?.accounts||{},g,"ytdActual",customLines));
  const ytdRevenue=ytdRevenueValues.some(v=>v!==null)?ytdRevenueValues.reduce<number>((s,v)=>s+(v??0),0):null;
  const ytdCostValues=costGroups.map(g=>sumGroup(form?.accounts||{},g,"ytdActual",customLines));
  const ytdCosts=ytdCostValues.some(v=>v!==null)?ytdCostValues.reduce<number>((s,v)=>s+(v??0),0):null;
  const otherIncomeValue=sumGroup(form?.accounts||{},"otherIncome","actual",customLines);
  const otherIncome=otherIncomeValue??0;
  const clusterTotal=(groups:readonly AccountGroup[],column:keyof AccountValue):number|null=>{
    const vals=groups.map(g=>sumGroup(form?.accounts||{},g,column,customLines));
    return vals.some(v=>v!==null)?vals.reduce<number>((total,v)=>total+(v??0),0):null;
  };
  const otherExpenseValue=clusterTotal(["otherExpenses"],"actual");
  const operatorFeeValue=clusterTotal(["operatorFees"],"actual");
  const provisionValue=clusterTotal(["provisions"],"actual");
  const depreciationValue=clusterTotal(["depreciation"],"actual");
  const amortizationValue=clusterTotal(["amortization"],"actual");
  const interestValue=clusterTotal(["interest"],"actual");
  const tax=sumGroup(form?.accounts||{},"tax","actual",customLines);
  const ownerCashItems=sumGroup(form?.accounts||{},"ownerCashItems","actual",customLines);
  const sumKnown=(values:(number|null)[])=>values.some(v=>v!==null)?values.reduce<number>((total,v)=>total+(v??0),0):null;
  const belowGopGroups=["otherExpenses","operatorFees","provisions","depreciation","amortization","interest"] as const;
  const otherExpenseGroups=[...belowGopGroups,"tax"] as const;
  const otherExpenseValues=otherExpenseGroups.map(g=>sumGroup(form?.accounts||{},g,"actual",customLines));
  const otherExpenses=sumKnown(otherExpenseValues);
  const gop=revenue!==null&&costs!==null?revenue-costs:null;
  const ebitdaInputs=[otherIncomeValue,otherExpenseValue,operatorFeeValue,provisionValue];
  const ebitda=gop!==null&&ebitdaInputs.some(v=>v!==null)?gop+(otherIncomeValue??0)-(otherExpenseValue??0)-(operatorFeeValue??0)-(provisionValue??0):null;
  const daCosts=sumKnown([depreciationValue,amortizationValue]);
  const ebit=ebitda!==null&&daCosts!==null?ebitda-daCosts:null;
  const ebt=ebit!==null&&interestValue!==null?ebit-interestValue:null;
  const eat=ebt!==null&&tax!==null?ebt-tax:null;
  // Backward-compatible field names: these represent EBT and EAT under the detailed P&L structure.
  const ownerShareProfitBeforeTax=ebt;
  const netProfit=eat;
  // Net profit is not operating cash flow; cash after CapEx requires a reconciled cash-flow statement.
  const ownerCashAfterCapex:null=null;
  const ytdOtherIncomeValue=sumGroup(form?.accounts||{},"otherIncome","ytdActual",customLines);
  const ytdOtherIncome=ytdOtherIncomeValue??0;
  const ytdOtherExpenseValue=sumGroup(form?.accounts||{},"otherExpenses","ytdActual",customLines);
  const ytdOperatorFeeValue=sumGroup(form?.accounts||{},"operatorFees","ytdActual",customLines);
  const ytdProvisionValue=sumGroup(form?.accounts||{},"provisions","ytdActual",customLines);
  const ytdDepreciationValue=sumGroup(form?.accounts||{},"depreciation","ytdActual",customLines);
  const ytdAmortizationValue=sumGroup(form?.accounts||{},"amortization","ytdActual",customLines);
  const ytdInterestValue=sumGroup(form?.accounts||{},"interest","ytdActual",customLines);
  const ytdTax=sumGroup(form?.accounts||{},"tax","ytdActual",customLines);
  const ytdOwnerCashItems=sumGroup(form?.accounts||{},"ownerCashItems","ytdActual",customLines);
  const ytdGop=ytdRevenue!==null&&ytdCosts!==null?ytdRevenue-ytdCosts:null;
  const ytdGopMargin=ytdRevenue!==null&&ytdRevenue>0&&ytdGop!==null?ytdGop/ytdRevenue*100:null;
  const ytdEbitdaInputs=[ytdOtherIncomeValue,ytdOtherExpenseValue,ytdOperatorFeeValue,ytdProvisionValue];
  const ytdEbitda=ytdGop!==null&&ytdEbitdaInputs.some(v=>v!==null)?ytdGop+(ytdOtherIncomeValue??0)-(ytdOtherExpenseValue??0)-(ytdOperatorFeeValue??0)-(ytdProvisionValue??0):null;
  const ytdDaCosts=sumKnown([ytdDepreciationValue,ytdAmortizationValue]);
  const ytdEbit=ytdEbitda!==null&&ytdDaCosts!==null?ytdEbitda-ytdDaCosts:null;
  const ytdEbt=ytdEbit!==null&&ytdInterestValue!==null?ytdEbit-ytdInterestValue:null;
  const ytdEat=ytdEbt!==null&&ytdTax!==null?ytdEbt-ytdTax:null;
  const ytdBelowGopValues=belowGopGroups.map(g=>sumGroup(form?.accounts||{},g,"ytdActual",customLines));
  const ytdBelowGopExpenses=sumKnown(ytdBelowGopValues);
  const ytdOwnerShareProfitBeforeTax=ytdEbt;
  const ytdNetProfit=ytdEat;
  const ytdOwnerCashAfterCapex:null=null;
  return {
    totalRoomBuild,roomAvailable,occupied,
    // Hotel occupancy includes all occupied room nights (paid + complimentary); ADR still uses paid room nights only.
    occupancy:roomAvailable!==null&&roomAvailable>0&&occupied!==null?occupied/roomAvailable*100:null,
    paidOccupancy:roomAvailable!==null&&roomAvailable>0&&paid!==null?paid/roomAvailable*100:null,
    adr:paid!==null&&paid>0&&roomRevenue!==null?roomRevenue/paid:null,
    revpar:roomAvailable!==null&&roomAvailable>0&&roomRevenue!==null?roomRevenue/roomAvailable:null,
    roomRevenue,revenue,costs,gop,gopMargin:revenue!==null&&revenue>0&&gop!==null?gop/revenue*100:null,
    otherIncome,otherExpenses,ebitda,ebit,ebt,eat,ownerShareProfitBeforeTax,ownerCashItems,ownerCashAfterCapex,netProfit,
    ytdRevenue,ytdCosts,ytdGop,ytdGopMargin,ytdOtherIncome,ytdEbitda,ytdEbit,ytdEbt,ytdEat,ytdOwnerShareProfitBeforeTax,ytdNetProfit,ytdOwnerCashItems,ytdOwnerCashAfterCapex,
    revenueGroups:Object.fromEntries(revenueGroups.map(g=>[g,sumGroup(form?.accounts||{},g,"actual",customLines)])),
    costGroups:Object.fromEntries(costGroups.map(g=>[g,sumGroup(form?.accounts||{},g,"actual",customLines)])),
    budgetRevenue: revenueGroups.map(g=>sumGroup(form?.accounts||{},g,"budget",customLines)).some(v=>v!==null)?revenueGroups.reduce((s,g)=>s+(sumGroup(form?.accounts||{},g,"budget",customLines)??0),0):null,
    lastYearRevenue: revenueGroups.map(g=>sumGroup(form?.accounts||{},g,"lastYear",customLines)).some(v=>v!==null)?revenueGroups.reduce((s,g)=>s+(sumGroup(form?.accounts||{},g,"lastYear",customLines)??0),0):null,
    ytdBudgetRevenue: revenueGroups.map(g=>sumGroup(form?.accounts||{},g,"ytdBudget",customLines)).some(v=>v!==null)?revenueGroups.reduce((s,g)=>s+(sumGroup(form?.accounts||{},g,"ytdBudget",customLines)??0),0):null,
    lastYearYtdRevenue: revenueGroups.map(g=>sumGroup(form?.accounts||{},g,"lastYearYtd",customLines)).some(v=>v!==null)?revenueGroups.reduce((s,g)=>s+(sumGroup(form?.accounts||{},g,"lastYearYtd",customLines)??0),0):null
  };
};
