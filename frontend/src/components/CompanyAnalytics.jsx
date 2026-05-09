import React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT = { SENT: "success", FAILED: "destructive" };

export default function CompanyAnalytics({ analytics }) {
  const rows = analytics ?? [];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Opened</TableHead>
            <TableHead className="text-right">Open rate</TableHead>
            <TableHead className="text-right">Follow-ups</TableHead>
            <TableHead className="text-right">Total opens</TableHead>
            <TableHead>Last interaction</TableHead>
            <TableHead>Statuses</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No analytics yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.company}>
                <TableCell className="font-medium text-foreground">
                  {row.company}
                </TableCell>
                <TableCell className="text-right">{row.total_emails}</TableCell>
                <TableCell className="text-right">{row.opened_emails}</TableCell>
                <TableCell className="text-right">
                  {row.total_emails
                    ? `${((row.opened_emails / row.total_emails) * 100).toFixed(1)}%`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">{row.follow_ups}</TableCell>
                <TableCell className="text-right">{row.total_opens}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {row.last_interaction
                    ? new Date(row.last_interaction).toLocaleString()
                    : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(row.email_statuses || "")
                      .split(", ")
                      .filter(Boolean)
                      .map((status) => (
                        <Badge
                          key={status}
                          variant={STATUS_VARIANT[status] ?? "secondary"}
                        >
                          {status}
                        </Badge>
                      ))}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
