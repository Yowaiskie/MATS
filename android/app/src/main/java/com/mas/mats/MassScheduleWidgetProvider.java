package com.mas.mats;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MassScheduleWidgetProvider extends AppWidgetProvider {

    public static final String PREFS_NAME = "MATS_WIDGET_PREFS";
    public static final String KEY_WIDGET_DATA = "WIDGET_DATA";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, MassScheduleWidgetProvider.class)
        );
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mass_schedule);

        // 1. PendingIntent to open app when widget is tapped
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        // 2. Read JSON data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawJson = prefs.getString(KEY_WIDGET_DATA, null);

        SimpleDateFormat dateSubtitleFormat = new SimpleDateFormat("EEE, MMM d", Locale.getDefault());
        String todaySubtitle = "Today: " + dateSubtitleFormat.format(new Date());
        views.setTextViewText(R.id.widget_date_subtitle, todaySubtitle);

        if (rawJson == null || rawJson.trim().isEmpty()) {
            views.setViewVisibility(R.id.widget_empty_text, View.VISIBLE);
            views.setViewVisibility(R.id.widget_items_container, View.GONE);
            views.setViewVisibility(R.id.widget_user_duty_banner, View.GONE);
            views.setTextViewText(R.id.widget_mass_count_badge, "0 Masses");
            views.setTextViewText(R.id.widget_last_updated, "Tap to open MATS & sync schedules");
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        try {
            JSONObject root = new JSONObject(rawJson);
            JSONArray items = root.optJSONArray("items");
            String lastUpdatedTime = root.optString("lastUpdated", "");
            JSONObject userDuty = root.optJSONObject("userDuty");

            // User Personal Duty Banner
            if (userDuty != null && userDuty.optBoolean("isAssigned", false)) {
                String dutyText = userDuty.optString("dutyText", "");
                if (!dutyText.isEmpty()) {
                    views.setViewVisibility(R.id.widget_user_duty_banner, View.VISIBLE);
                    views.setTextViewText(R.id.widget_user_duty_text, dutyText);
                } else {
                    views.setViewVisibility(R.id.widget_user_duty_banner, View.GONE);
                }
            } else {
                views.setViewVisibility(R.id.widget_user_duty_banner, View.GONE);
            }

            if (items == null || items.length() == 0) {
                views.setViewVisibility(R.id.widget_empty_text, View.VISIBLE);
                views.setViewVisibility(R.id.widget_items_container, View.GONE);
                views.setTextViewText(R.id.widget_mass_count_badge, "0 Masses");
                views.setTextViewText(R.id.widget_last_updated, "No masses today/tomorrow • Tap to open");
            } else {
                views.setViewVisibility(R.id.widget_empty_text, View.GONE);
                views.setViewVisibility(R.id.widget_items_container, View.VISIBLE);
                views.setTextViewText(R.id.widget_mass_count_badge, items.length() + " Masses");

                if (!lastUpdatedTime.isEmpty()) {
                    views.setTextViewText(R.id.widget_last_updated, "Updated: " + lastUpdatedTime + " • Tap to open");
                } else {
                    views.setTextViewText(R.id.widget_last_updated, "Tap widget to open MATS Portal");
                }

                // Item 1
                if (items.length() >= 1) {
                    JSONObject item1 = items.getJSONObject(0);
                    boolean isUser1 = item1.optBoolean("isUserAssigned", false);
                    views.setViewVisibility(R.id.widget_item_1, View.VISIBLE);
                    views.setViewVisibility(R.id.widget_item_1_duty_badge, isUser1 ? View.VISIBLE : View.GONE);
                    views.setInt(
                            R.id.widget_item_1,
                            "setBackgroundResource",
                            isUser1 ? R.drawable.widget_item_duty_bg : R.drawable.widget_item_bg
                    );
                    views.setTextViewText(R.id.widget_item_1_badge, item1.optString("badge", "TODAY"));
                    views.setTextViewText(R.id.widget_item_1_title, item1.optString("title", "Mass"));
                    views.setTextViewText(R.id.widget_item_1_servers, item1.optString("servers", "No servers assigned"));
                } else {
                    views.setViewVisibility(R.id.widget_item_1, View.GONE);
                }

                // Item 2
                if (items.length() >= 2) {
                    JSONObject item2 = items.getJSONObject(1);
                    boolean isUser2 = item2.optBoolean("isUserAssigned", false);
                    views.setViewVisibility(R.id.widget_item_2, View.VISIBLE);
                    views.setViewVisibility(R.id.widget_item_2_duty_badge, isUser2 ? View.VISIBLE : View.GONE);
                    views.setInt(
                            R.id.widget_item_2,
                            "setBackgroundResource",
                            isUser2 ? R.drawable.widget_item_duty_bg : R.drawable.widget_item_bg
                    );
                    views.setTextViewText(R.id.widget_item_2_badge, item2.optString("badge", "TODAY"));
                    views.setTextViewText(R.id.widget_item_2_title, item2.optString("title", "Mass"));
                    views.setTextViewText(R.id.widget_item_2_servers, item2.optString("servers", "No servers assigned"));
                } else {
                    views.setViewVisibility(R.id.widget_item_2, View.GONE);
                }

                // Item 3
                if (items.length() >= 3) {
                    JSONObject item3 = items.getJSONObject(2);
                    boolean isUser3 = item3.optBoolean("isUserAssigned", false);
                    views.setViewVisibility(R.id.widget_item_3, View.VISIBLE);
                    views.setViewVisibility(R.id.widget_item_3_duty_badge, isUser3 ? View.VISIBLE : View.GONE);
                    views.setInt(
                            R.id.widget_item_3,
                            "setBackgroundResource",
                            isUser3 ? R.drawable.widget_item_duty_bg : R.drawable.widget_item_bg
                    );
                    views.setTextViewText(R.id.widget_item_3_badge, item3.optString("badge", "TOMORROW"));
                    views.setTextViewText(R.id.widget_item_3_title, item3.optString("title", "Mass"));
                    views.setTextViewText(R.id.widget_item_3_servers, item3.optString("servers", "No servers assigned"));
                } else {
                    views.setViewVisibility(R.id.widget_item_3, View.GONE);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            views.setViewVisibility(R.id.widget_empty_text, View.VISIBLE);
            views.setViewVisibility(R.id.widget_items_container, View.GONE);
            views.setViewVisibility(R.id.widget_user_duty_banner, View.GONE);
            views.setTextViewText(R.id.widget_mass_count_badge, "MATS");
            views.setTextViewText(R.id.widget_last_updated, "Tap to open MATS");
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
