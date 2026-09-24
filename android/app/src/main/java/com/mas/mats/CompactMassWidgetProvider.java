package com.mas.mats;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class CompactMassWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, CompactMassWidgetProvider.class)
        );
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetIds, R.id.compact_list_view);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_compact_mass);

        // 1. PendingIntent for launching app
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.compact_widget_root, pendingIntent);
        views.setPendingIntentTemplate(R.id.compact_list_view, pendingIntent);

        // 2. Set RemoteAdapter for scrollable ListView with distinct Content URI
        Intent serviceIntent = new Intent(context, CompactWidgetService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse("content://com.mas.mats.widget/" + appWidgetId));
        views.setRemoteAdapter(R.id.compact_list_view, serviceIntent);
        views.setEmptyView(R.id.compact_list_view, R.id.compact_empty_text);

        // 3. Read JSON data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(
                MassScheduleWidgetProvider.PREFS_NAME,
                Context.MODE_PRIVATE
        );
        String rawJson = prefs.getString(MassScheduleWidgetProvider.KEY_WIDGET_DATA, null);

        if (rawJson == null || rawJson.trim().isEmpty()) {
            views.setTextViewText(R.id.compact_count_badge, "0 Masses");
            views.setViewVisibility(R.id.compact_user_duty_badge, View.GONE);
            views.setViewVisibility(R.id.compact_user_duty_banner, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.compact_list_view);
            return;
        }

        try {
            JSONObject root = new JSONObject(rawJson);
            JSONArray items = root.optJSONArray("items");
            JSONObject userDuty = root.optJSONObject("userDuty");
            int count = items != null ? items.length() : 0;

            // User Duty Banner & Header Badge
            if (userDuty != null && userDuty.optBoolean("isAssigned", false)) {
                String dutyText = userDuty.optString("dutyText", "");
                views.setViewVisibility(R.id.compact_user_duty_badge, View.VISIBLE);
                views.setTextViewText(R.id.compact_user_duty_badge, "SCHEDULE");
                views.setViewVisibility(R.id.compact_count_badge, View.GONE);
                if (!dutyText.isEmpty()) {
                    views.setViewVisibility(R.id.compact_user_duty_banner, View.VISIBLE);
                    views.setTextViewText(R.id.compact_user_duty_text, dutyText);
                } else {
                    views.setViewVisibility(R.id.compact_user_duty_banner, View.GONE);
                }
            } else {
                views.setViewVisibility(R.id.compact_user_duty_badge, View.GONE);
                views.setViewVisibility(R.id.compact_count_badge, View.VISIBLE);
                views.setTextViewText(R.id.compact_count_badge, count + (count == 1 ? " Mass" : " Masses"));
                views.setViewVisibility(R.id.compact_user_duty_banner, View.GONE);
            }

        } catch (Exception e) {
            e.printStackTrace();
            views.setTextViewText(R.id.compact_count_badge, "MATS");
            views.setViewVisibility(R.id.compact_user_duty_badge, View.GONE);
            views.setViewVisibility(R.id.compact_user_duty_banner, View.GONE);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.compact_list_view);
    }
}
