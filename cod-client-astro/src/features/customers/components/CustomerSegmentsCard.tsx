import { useState } from "react";
import {
  AlertCircle,
  Layers,
  Plus,
  Search,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconButton,
  useConfirmDialog,
} from "@/components/ui";
import {
  canScope,
  useIdentity,
} from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { SCOPES } from "../../../../../cod-shared/rbac/scopes";
import {
  addCustomerToGroup,
  assignCustomerTag,
  removeCustomerFromGroup,
  unassignCustomerTag,
} from "@/features/customers/api";
import { customerErrorMessage } from "@/features/customers/model";
import type {
  Customer,
  CustomerGroup,
  CustomerGroupMembership,
  CustomerTag,
  CustomerTagMembership,
} from "@/features/customers/types";

interface CustomerSegmentsCardProps {
  customer: Customer;
  groups: CustomerGroupMembership[];
  tags: CustomerTagMembership[];
  allGroups: CustomerGroup[];
  allTags: CustomerTag[];
  reload: () => Promise<void>;
}

export function CustomerSegmentsCard({
  customer,
  groups,
  tags,
  allGroups,
  allTags,
  reload,
}: CustomerSegmentsCardProps) {
  const t = useT("customers");
  const common = useT("common");
  const identity = useIdentity();
  const confirm = useConfirmDialog();

  const [groupOpen, setGroupOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManageGroups = canScope(identity, SCOPES.CUSTOMER_GROUPS_MANAGE);
  const canManageTags = canScope(identity, SCOPES.CUSTOMER_TAGS_MANAGE);

  const assignedGroupIds = new Set(groups.map((group) => group.id));
  const assignedTagIds = new Set(tags.map((tag) => tag.id));

  const availableGroups = allGroups.filter(
    (group) =>
      !assignedGroupIds.has(group.id) &&
      group.name.toLocaleLowerCase().includes(groupQuery.toLocaleLowerCase()),
  );
  const availableTags = allTags.filter(
    (tag) =>
      !assignedTagIds.has(tag.id) &&
      tag.name.toLocaleLowerCase().includes(tagQuery.toLocaleLowerCase()),
  );

  async function run(
    key: string,
    task: () => Promise<unknown>,
    successMessage: string,
  ) {
    setBusy(key);
    setError(null);
    try {
      await task();
      await reload();
      notify.success(successMessage);
    } catch (cause) {
      const message = customerErrorMessage(cause, t);
      setError(message);
      notify.error(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert role="alert" tone="critical">
          <AlertCircle size={18} />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            aria-label={common("cancel")}
            onClick={() => setError(null)}
          >
            <X size={16} />
          </button>
        </Alert>
      )}
      <Card
        title={t("segments.groups_title")}
        action={
          canManageGroups ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setGroupOpen((current) => !current);
                setTagOpen(false);
              }}
            >
              <UserPlus size={15} />
              {t("segments.add_group")}
            </Button>
          ) : undefined
        }
      >
        {groupOpen && (
          <div className="mb-5 border-b border-border pb-4">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={groupQuery}
                onChange={(event) => setGroupQuery(event.currentTarget.value)}
                placeholder={t("segments.search_group")}
                className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <div className="mt-2 max-h-48 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {availableGroups.slice(0, 15).map((group) => (
                <div key={group.id} className="flex items-center gap-3 p-2">
                  <span
                    className="size-3 rounded-sm"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {group.name}
                  </span>
                  <IconButton
                    type="button"
                    variant="solid"
                    aria-label={t("segments.add_group")}
                    title={t("segments.add_group")}
                    disabled={busy === `group-${group.id}`}
                    onClick={() =>
                      void run(
                        `group-${group.id}`,
                        () => addCustomerToGroup(group.id, customer.id),
                        t("segments.group_added"),
                      )
                    }
                  >
                    <Plus size={15} />
                  </IconButton>
                </div>
              ))}
              {availableGroups.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {t("segments.no_groups")}
                </p>
              )}
            </div>
          </div>
        )}
        {groups.length === 0 ? (
          <EmptyState
            icon={<Layers size={22} />}
            title={t("segments.no_groups")}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <span
                key={group.id}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-sm font-semibold text-foreground"
              >
                <span
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: group.color }}
                />
                {group.name}
                {canManageGroups && (
                  <button
                    type="button"
                    aria-label={common("remove")}
                    title={common("remove")}
                    disabled={busy === `remove-group-${group.id}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: common("confirm_remove_title").replace(
                            "{name}",
                            group.name,
                          ),
                          description: common("remove_description"),
                          confirmLabel: common("remove"),
                          tone: "danger",
                        })
                      )
                        void run(
                          `remove-group-${group.id}`,
                          () => removeCustomerFromGroup(group.id, customer.id),
                          t("segments.group_removed"),
                        );
                    }}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </Card>
      <Card
        title={t("segments.tags_title")}
        action={
          canManageTags ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTagOpen((current) => !current);
                setGroupOpen(false);
              }}
            >
              <Plus size={15} />
              {t("segments.add_tag")}
            </Button>
          ) : undefined
        }
      >
        {tagOpen && (
          <div className="mb-5 border-b border-border pb-4">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={tagQuery}
                onChange={(event) => setTagQuery(event.currentTarget.value)}
                placeholder={t("segments.search_tag")}
                className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border p-2">
              {availableTags.slice(0, 20).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  disabled={busy === `tag-${tag.id}`}
                  onClick={() =>
                    void run(
                      `tag-${tag.id}`,
                      () => assignCustomerTag(tag.id, customer.id),
                      t("segments.tag_added"),
                    )
                  }
                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-sm font-semibold text-foreground disabled:opacity-50"
                >
                  <span
                    className="size-3 rounded-sm"
                    style={{ backgroundColor: tag.color }}
                  />
                  <Plus size={13} />
                  {tag.name}
                </button>
              ))}
              {availableTags.length === 0 && (
                <p className="w-full p-4 text-center text-sm text-muted-foreground">
                  {t("segments.no_tags")}
                </p>
              )}
            </div>
          </div>
        )}
        {tags.length === 0 ? (
          <EmptyState icon={<Tag size={22} />} title={t("segments.no_tags")} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 text-sm font-semibold text-foreground"
              >
                <span
                  className="size-3 rounded-sm"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
                {canManageTags && (
                  <button
                    type="button"
                    aria-label={common("remove")}
                    title={common("remove")}
                    disabled={busy === `remove-tag-${tag.id}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: common("confirm_remove_title").replace(
                            "{name}",
                            tag.name,
                          ),
                          description: common("remove_description"),
                          confirmLabel: common("remove"),
                          tone: "danger",
                        })
                      )
                        void run(
                          `remove-tag-${tag.id}`,
                          () => unassignCustomerTag(tag.id, customer.id),
                          t("segments.tag_removed"),
                        );
                    }}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
