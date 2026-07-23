- Oauth with Google + set res.cookies --done

- auth middleware --done
- workspaces (create, get etc..)  --done check with roles

- role based access for the workspace + middleware --done

- upload files to the workspaces + cache the list --done with cache and cache invalidation

- worker for export jobs.. --done
- download feature --done

- rate limiting --done
- public sharing and video streaming with chunks --done
- thumbnail gen in background --done

- user Storage Quotas --done


- audit logs / Activity History (track who uploaded/deleted/shared files)
- soft deletes (Trash Bin) with 30-day recovery (don't hard-delete immediately)
- garbage collection Workers (cleanup abandoned PENDING uploads and expired exports)
- file versioning (keep previous revisions when a file is replaced)
- anti-virus / Malware scanning on uploads


--- lets finish audit logs, soft deletes, garbage collection within 2 hours ---