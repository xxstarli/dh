CREATE TABLE "categories" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "sort_order" INTEGER NOT NULL, "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" DATETIME NOT NULL);
CREATE TABLE "sites" ("id" TEXT NOT NULL PRIMARY KEY, "category_id" TEXT NOT NULL, "name" TEXT NOT NULL, "url" TEXT NOT NULL, "icon_type" TEXT NOT NULL DEFAULT 'default' CHECK ("icon_type" IN ('auto','custom','default')), "icon_url" TEXT, "description" TEXT, "sort_order" INTEGER NOT NULL, "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" DATETIME NOT NULL, CONSTRAINT "sites_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE TABLE "settings" ("id" TEXT NOT NULL PRIMARY KEY CHECK ("id" = 'singleton'), "site_name" TEXT NOT NULL DEFAULT '我的导航', "site_logo" TEXT, "admin_password_hash" TEXT NOT NULL, "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" DATETIME NOT NULL);
CREATE TABLE "admin_sessions" ("id" TEXT NOT NULL PRIMARY KEY, "expires_at" DATETIME NOT NULL, "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");
CREATE INDEX "sites_category_id_sort_order_idx" ON "sites"("category_id", "sort_order");
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");
