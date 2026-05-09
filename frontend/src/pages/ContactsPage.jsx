import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MoreHorizontal,
  Plus,
  Trash2,
  Pencil,
  Upload,
} from "lucide-react";

import {
  deleteContactList,
  getContactList,
  listContactLists,
  updateContactList,
} from "@/lib/api";
import { useAction } from "@/lib/useAction";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SOURCE_VARIANT = { TEXT_FILE: "secondary", APOLLO: "info" };

export default function ContactsPage() {
  const navigate = useNavigate();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [editingList, setEditingList] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await listContactLists();
      setLists(data);
    } catch (err) {
      setFetchError(err.message ?? "Failed to load contact lists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openEdit = async (row) => {
    setEditLoading(true);
    setEditError(null);
    try {
      const detail = await getContactList(row.id);
      setEditingList({
        id: detail.id,
        name: detail.name,
        source: detail.source,
        contacts: detail.contacts.map((c) => ({ ...c })),
      });
    } catch (err) {
      setEditError(err.message ?? "Failed to load list.");
    } finally {
      setEditLoading(false);
    }
  };

  const { run: doSaveEdit, isPending: saving } = useAction(
    () =>
      updateContactList(editingList.id, {
        name: editingList.name,
        contacts: editingList.contacts.map((c) => ({
          id: c.id ?? null,
          name: c.name,
          email: c.email,
          company: c.company,
        })),
      }),
    {
      loading: "Saving list...",
      success: "List saved",
      onSuccess: () => {
        setEditingList(null);
        refresh();
      },
    }
  );

  const { run: doDelete, isPending: deleting } = useAction(
    () => deleteContactList(deleteTarget.id),
    {
      loading: "Deleting list...",
      success: "List deleted",
      onSuccess: () => {
        setDeleteTarget(null);
        refresh();
      },
    }
  );

  const updateContact = (idx, field, value) =>
    setEditingList((prev) => {
      const next = [...prev.contacts];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, contacts: next };
    });

  const removeContact = (idx) =>
    setEditingList((prev) => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== idx),
    }));

  const addContact = () =>
    setEditingList((prev) => ({
      ...prev,
      contacts: [
        ...prev.contacts,
        { id: null, name: "", email: "", company: "" },
      ],
    }));

  const canSave =
    editingList?.name.trim().length > 0 &&
    editingList?.contacts.every(
      (c) => c.name.trim() && c.email.trim() && c.company.trim()
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Manage the lists you'll target with campaigns.
          </p>
        </div>
        <Button onClick={() => navigate("/contacts/import")} data-testid="import-new-list-btn">
          <Upload />
          Import new list
        </Button>
      </header>

      {fetchError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load contact lists</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : lists.length === 0 ? (
        <EmptyState onImport={() => navigate("/contacts/import")} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((l) => (
                <TableRow key={l.id} data-testid={`list-row-${l.id}`}>
                  <TableCell className="font-medium text-foreground">
                    {l.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SOURCE_VARIANT[l.source] ?? "secondary"}>
                      {l.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.created_at
                      ? new Date(l.created_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`actions-${l.id}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            openEdit(l);
                          }}
                          aria-label={`edit-${l.id}`}
                        >
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            setDeleteTarget(l);
                          }}
                          aria-label={`delete-${l.id}`}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet
        open={Boolean(editingList) || editLoading}
        onOpenChange={(open) => {
          if (!open) {
            setEditingList(null);
            setEditError(null);
          }
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border px-6 py-4">
            <SheetTitle>Edit contact list</SheetTitle>
            <SheetDescription>
              Rename the list, fix typos, or remove contacts before sending.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {editLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9 w-1/2" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : editingList ? (
              <div className="space-y-4">
                {editError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{editError}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="list-name">List name</Label>
                  <Input
                    id="list-name"
                    value={editingList.name}
                    onChange={(e) =>
                      setEditingList((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editingList.contacts.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            No contacts. Add one below.
                          </TableCell>
                        </TableRow>
                      ) : (
                        editingList.contacts.map((c, idx) => (
                          <TableRow key={c.id ?? `new-${idx}`}>
                            <TableCell>
                              <Input
                                value={c.name}
                                onChange={(e) =>
                                  updateContact(idx, "name", e.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="email"
                                value={c.email}
                                onChange={(e) =>
                                  updateContact(idx, "email", e.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={c.company}
                                onChange={(e) =>
                                  updateContact(idx, "company", e.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`remove-row-${idx}`}
                                onClick={() => removeContact(idx)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Button
                  variant="outline"
                  onClick={addContact}
                  data-testid="add-contact-btn"
                >
                  <Plus />
                  Add contact
                </Button>
              </div>
            ) : null}
          </div>
          <SheetFooter className="border-t border-border px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setEditingList(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => doSaveEdit()}
              loading={saving}
              disabled={!canSave || saving}
              data-testid="save-list-btn"
            >
              Save changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contact list?</DialogTitle>
            <DialogDescription>
              "<strong>{deleteTarget?.name}</strong>" and all of its contacts will
              be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => doDelete()}
              loading={deleting}
              data-testid="confirm-delete-list-btn"
            >
              Delete list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ onImport }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
      <h2 className="text-base font-semibold">No contact lists yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Import a CSV or text file to start sending campaigns.
      </p>
      <Button className="mt-4" onClick={onImport}>
        <Upload />
        Import your first list
      </Button>
    </div>
  );
}
