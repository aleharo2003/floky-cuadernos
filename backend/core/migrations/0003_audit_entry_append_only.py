from django.db import migrations

FORBID = """
CREATE OR REPLACE FUNCTION core_auditentry_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'core_auditentry is append only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER core_auditentry_no_update_or_delete
BEFORE UPDATE OR DELETE ON core_auditentry
FOR EACH ROW EXECUTE FUNCTION core_auditentry_append_only();
"""

ALLOW = """
DROP TRIGGER IF EXISTS core_auditentry_no_update_or_delete ON core_auditentry;
DROP FUNCTION IF EXISTS core_auditentry_append_only();
"""


class Migration(migrations.Migration):
    dependencies = [("core", "0002_audit_entry")]

    operations = [migrations.RunSQL(FORBID, ALLOW)]
