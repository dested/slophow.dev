import { fmtCost, fmtDate, fmtHours } from '~/lib/fmt'

// The signature element: a project's AI metadata printed as a thermal-printer
// receipt. Every field is optional/self-reported — missing lines just don't
// print.
export function Receipt({
  title,
  username,
  createdAt,
  models,
  tools,
  costUsd,
  buildHours,
  humanPercent,
}: {
  title: string
  username: string | null
  createdAt: string
  models: string[]
  tools: string[]
  costUsd: number | null
  buildHours: number | null
  humanPercent: number | null
}) {
  const cost = fmtCost(costUsd)
  const hours = fmtHours(buildHours)
  const nothingReported =
    models.length === 0 && tools.length === 0 && !cost && !hours && humanPercent == null

  return (
    <div className="shadow-hard">
      <div className="border-ink bg-card border-2 border-b-0 px-5 pt-5 pb-6 font-mono text-[0.8rem] leading-relaxed">
        <p className="text-center text-base font-bold tracking-[0.2em]">SLOPSHOW</p>
        <p className="text-muted-foreground text-center text-[0.65rem] tracking-[0.14em]">
          ★ AI RECEIPT ★
        </p>

        <div className="receipt-rule my-3" />
        <Line k="ITEM" v={title.toUpperCase()} />
        {username && <Line k="BUILDER" v={`@${username}`} />}
        <Line k="DATE" v={fmtDate(createdAt)} />
        <div className="receipt-rule my-3" />

        {nothingReported ? (
          <p className="text-muted-foreground py-2 text-center text-[0.7rem] tracking-wide">
            NO RECEIPTS PROVIDED.
            <br />
            SUSPICIOUS, HONESTLY.
          </p>
        ) : (
          <div className="space-y-1">
            {models.length > 0 && (
              <Line k={models.length > 1 ? 'MODELS' : 'MODEL'} v={models.join(', ')} />
            )}
            {tools.length > 0 && <Line k="TOOLS" v={tools.join(', ')} />}
            {hours && <Line k="BUILD TIME" v={hours} />}
            {cost && <Line k="EST. SPEND" v={cost} />}
            {humanPercent != null && (
              <>
                <Line k="HUMAN-WROTE" v={`${humanPercent}%`} />
                <Meter percent={humanPercent} />
              </>
            )}
          </div>
        )}

        <div className="receipt-rule my-3" />
        {cost && (
          <div className="flex justify-between text-sm font-bold">
            <span>TOTAL DAMAGE</span>
            <span>{cost}</span>
          </div>
        )}
        <p className="text-muted-foreground mt-3 text-center text-[0.65rem] tracking-[0.18em]">
          THANK YOU FOR SLOPPING
        </p>
        <div className="barcode mx-auto mt-3 h-8 w-40" />
      </div>
      <div className="tear-edge border-ink border-x-2" />
    </div>
  )
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{k}</span>
      <span className="text-right font-semibold [overflow-wrap:anywhere]">{v}</span>
    </div>
  )
}

// ASCII-style human/robot split bar.
function Meter({ percent }: { percent: number }) {
  return (
    <div className="pt-1">
      <div className="border-ink flex h-3.5 border">
        <div className="bg-ink h-full" style={{ width: `${percent}%` }} />
        <div className="bg-acid h-full grow" />
      </div>
      <div className="text-muted-foreground flex justify-between text-[0.6rem] tracking-wider">
        <span>HUMAN</span>
        <span>ROBOT {100 - percent}%</span>
      </div>
    </div>
  )
}
