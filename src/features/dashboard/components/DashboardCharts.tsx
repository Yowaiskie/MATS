import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts'
import type { DashboardStats } from '@/services/dashboardService'
import { Card } from '@/components/Card'

interface DashboardChartsProps {
  stats: DashboardStats
}

// Group / Order Color Mapping matching MATS Order Theme
const GROUP_COLORS: Record<string, string> = {
  'San Pedro': '#ef4444',
  'San Juan': '#3b82f6',
  'San Tiago': '#10b981',
  'San Andres': '#f59e0b',
  'Officers': '#8b5cf6',
  'Squires': '#ec4899', // Vibrant Pink / Rose - 100% distinct from all other group colors
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ stats }) => {
  // Group Performance / Attendance Participation Data (Mock/Estimated per Order Group)
  const groupPerformanceData = [
    { name: 'San Pedro', value: 35, percentage: '35%' },
    { name: 'San Juan', value: 28, percentage: '28%' },
    { name: 'San Tiago', value: 22, percentage: '22%' },
    { name: 'San Andres', value: 18, percentage: '18%' },
    { name: 'Officers', value: 15, percentage: '15%' },
    { name: 'Squires', value: 12, percentage: '12%' },
  ]

  // Schedules Status Data
  const scheduleData = [
    { name: 'Completed', count: stats.completedSchedules },
    { name: 'Ongoing', count: stats.ongoingSchedules },
    { name: 'Upcoming', count: stats.upcomingSchedules },
  ]

  // Monthly Attendance Trend (Easier to read than Week 1, Week 2)
  const attendanceTrendData = [
    { name: 'Feb', attendees: 45 },
    { name: 'Mar', attendees: 52 },
    { name: 'Apr', attendees: 48 },
    { name: 'May', attendees: 61 },
    { name: 'Jun', attendees: 55 },
    { name: 'Jul', attendees: Math.max(30, stats.activeMembers - 5) },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {/* Group Attendance Performance Pie Chart */}
      <Card title="Group Performance" description="Attendance share by Order / Group">
        <div className="h-64 mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={groupPerformanceData}
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {groupPerformanceData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={GROUP_COLORS[entry.name] || '#3b82f6'} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(val: any) => [`${val} Services Recorded`, 'Total']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={40} 
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Attendance Trend Line Chart */}
      <Card title="Attendance Trend" description="Recent weekly server attendance">
        <div className="h-64 mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={attendanceTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="attendees" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Schedules Bar Chart */}
      <Card title="Schedules Overview" description="Status of all recorded schedules">
        <div className="h-64 mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scheduleData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                allowDecimals={false}
              />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scheduleData.map((entry, index) => {
                  let color = '#3b82f6'
                  if (entry.name === 'Completed') color = '#8b5cf6'
                  if (entry.name === 'Ongoing') color = '#3b82f6'
                  if (entry.name === 'Upcoming') color = '#10b981'
                  return <Cell key={`cell-${index}`} fill={color} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
