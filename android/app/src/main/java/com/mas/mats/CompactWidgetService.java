package com.mas.mats;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class CompactWidgetService extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new CompactRemoteViewsFactory(this.getApplicationContext(), intent);
    }
}

class CompactRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {

    private final Context context;
    private final List<JSONObject> itemsList = new ArrayList<>();

    public CompactRemoteViewsFactory(Context context, Intent intent) {
        this.context = context;
    }

    @Override
    public void onCreate() {
        loadData();
    }

    @Override
    public void onDataSetChanged() {
        loadData();
    }

    private synchronized void loadData() {
        itemsList.clear();
        try {
            SharedPreferences prefs = context.getSharedPreferences(
                    MassScheduleWidgetProvider.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            String rawJson = prefs.getString(MassScheduleWidgetProvider.KEY_WIDGET_DATA, null);
            if (rawJson != null && !rawJson.trim().isEmpty()) {
                JSONObject root = new JSONObject(rawJson);
                JSONArray arr = root.optJSONArray("items");
                if (arr != null) {
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject item = arr.optJSONObject(i);
                        if (item != null) {
                            itemsList.add(item);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        itemsList.clear();
    }

    @Override
    public synchronized int getCount() {
        return itemsList.size();
    }

    @Override
    public synchronized RemoteViews getViewAt(int position) {
        if (position < 0 || position >= itemsList.size()) {
            return null;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_compact_item);
        try {
            JSONObject item = itemsList.get(position);
            String badge = item.optString("badge", "TODAY");
            String title = item.optString("title", "Mass Schedule");
            String servers = item.optString("servers", "No servers assigned");
            boolean isUserAssigned = item.optBoolean("isUserAssigned", false);

            views.setTextViewText(R.id.compact_item_day_badge, badge);
            boolean isTomorrow = badge.toUpperCase().contains("TOMORROW");
            views.setInt(
                    R.id.compact_item_day_badge,
                    "setBackgroundResource",
                    isTomorrow ? R.drawable.widget_badge_tomorrow : R.drawable.widget_badge_today
            );

            views.setTextViewText(R.id.compact_item_title, title);
            views.setTextViewText(R.id.compact_item_servers, servers);

            // Duty badge & highlight
            if (isUserAssigned) {
                views.setViewVisibility(R.id.compact_item_duty_badge, View.VISIBLE);
                views.setInt(
                        R.id.compact_item_root,
                        "setBackgroundResource",
                        R.drawable.widget_item_duty_bg
                );
            } else {
                views.setViewVisibility(R.id.compact_item_duty_badge, View.GONE);
                views.setInt(
                        R.id.compact_item_root,
                        "setBackgroundResource",
                        R.drawable.widget_item_bg
                );
            }

            // Fill-in Intent for item click
            Intent fillInIntent = new Intent();
            views.setOnClickFillInIntent(R.id.compact_item_root, fillInIntent);

        } catch (Exception e) {
            e.printStackTrace();
        }

        return views;
    }

    @Override
    public RemoteViews getLoadingView() {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_compact_item);
        views.setTextViewText(R.id.compact_item_day_badge, "UPCOMING");
        views.setTextViewText(R.id.compact_item_title, "Loading masses...");
        views.setTextViewText(R.id.compact_item_servers, "");
        views.setViewVisibility(R.id.compact_item_duty_badge, View.GONE);
        return views;
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return false;
    }
}
