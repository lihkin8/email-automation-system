import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT = {
  sent: "info",
  delivered: "success",
  failed: "destructive",
};
const TYPE_VARIANT = {
  main: "secondary",
  follow_up: "warning",
};

function variantFor(map, value, fallback = "outline") {
  return map[value?.toLowerCase()] ?? fallback;
}

export default function EmailTable({ analytics, pagination, onPageChange }) {
  const rows = analytics ?? [];
  const config = pagination ?? {
    total: rows.length,
    page: 1,
    page_size: rows.length || 20,
    total_pages: 1,
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Recruiter</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Opened</TableHead>
            <TableHead>Opens</TableHead>
            <TableHead>Sent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                No emails to show.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, idx) => (
              <TableRow key={row.email_id ?? idx}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium text-foreground">
                  {row.recruiter_name}
                </TableCell>
                <TableCell>{row.company}</TableCell>
                <TableCell>
                  <Badge variant={variantFor(TYPE_VARIANT, row.email_type)}>
                    {row.email_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={variantFor(STATUS_VARIANT, row.status)}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row.is_opened ? "success" : "outline"}>
                    {row.is_opened ? "Opened" : "Not opened"}
                  </Badge>
                </TableCell>
                <TableCell className={cn(row.open_count > 0 && "text-foreground")}>
                  {row.open_count ?? 0}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {row.sent_date
                    ? new Date(row.sent_date).toLocaleString()
                    : "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pagination ? (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            Showing {(config.page - 1) * config.page_size + 1}–
            {Math.min(config.page * config.page_size, config.total)} of {config.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={config.page <= 1}
              onClick={() => onPageChange?.(config.page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">
              Page {config.page} / {config.total_pages || 1}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={config.page >= (config.total_pages || 1)}
              onClick={() => onPageChange?.(config.page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
