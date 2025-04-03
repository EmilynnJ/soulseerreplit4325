import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Reading, Product } from "@shared/schema";
import { Loader2, User as UserIcon, BookOpen, Users, Package, RefreshCw, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useRef } from "react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { GiftManagement } from "./gift-management";

// Helper function to get status color for readings
function getStatusColor(status: string): string {
  switch (status) {
    case "scheduled":
      return "bg-blue-500 hover:bg-blue-600";
    case "waiting_payment":
      return "bg-amber-500 hover:bg-amber-600";
    case "payment_completed":
      return "bg-emerald-500 hover:bg-emerald-600";
    case "in_progress":
      return "bg-purple-500 hover:bg-purple-600";
    case "completed":
      return "bg-green-500 hover:bg-green-600";
    case "cancelled":
      return "bg-red-500 hover:bg-red-600";
    default:
      return "bg-gray-500 hover:bg-gray-600";
  }
}

// Helper function to format reading status for display
function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Interface for reader data with session count
interface ReaderWithStats extends User {
  sessionCount?: number;
  totalEarnings?: number;
}

// Interface for reading data with names
interface ReadingWithNames extends Reading {
  clientName: string;
  readerName: string;
}

export function AdminDashboard() {
  const { toast } = useToast();

  // Fetch all readings
  const {
    data: readings,
    error: readingsError,
    isLoading: readingsLoading,
  } = useQuery<ReadingWithNames[]>({
    queryKey: ["/api/admin/readings"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch all readers
  const {
    data: readers,
    error: readersError,
    isLoading: readersLoading,
  } = useQuery<User[]>({
    queryKey: ["/api/admin/readers"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch all users
  const {
    data: users,
    error: usersError,
    isLoading: usersLoading,
  } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Calculate reader stats
  const readersWithStats: ReaderWithStats[] = readers?.map(reader => {
    const readerReadings = readings?.filter(reading => reading.readerId === reader.id) || [];
    const completedReadings = readerReadings.filter(reading => reading.status === "completed");
    const totalEarnings = completedReadings.reduce((sum, reading) => sum + (reading.totalPrice || 0), 0);

    return {
      ...reader,
      sessionCount: readerReadings.length,
      totalEarnings,
    };
  }) || [];

  // Calculate platform stats
  const totalUsers = users?.length || 0;
  const totalReaders = readers?.length || 0;
  const totalClients = users?.filter(user => user.role === "client")?.length || 0;
  const totalReadings = readings?.length || 0;
  const completedReadings = readings?.filter(reading => reading.status === "completed")?.length || 0;
  const totalRevenue = readings?.filter(reading => reading.status === "completed")
    .reduce((sum, reading) => sum + (reading.totalPrice || 0), 0) || 0;

  if (readingsLoading || readersLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  // Enhanced error handling with more detailed fallback
  if (readingsError || readersError || usersError) {
    console.error('Admin dashboard errors:', { 
      readingsError, 
      readersError, 
      usersError 
    });

    return (
      <div className="text-center p-6 bg-primary-dark/40 border border-accent/20 rounded-lg">
        <h3 className="text-xl font-cinzel text-accent mb-2">Error Loading Dashboard</h3>
        <p className="font-playfair text-light/90 mb-4">There was a problem loading the admin dashboard data.</p>
        <Button 
          onClick={() => {
            // Invalidate all admin queries to force a refresh
            queryClient.invalidateQueries({ queryKey: ['/api/admin'] });
            window.location.reload();
          }}
          className="bg-accent hover:bg-accent/80 text-primary-dark"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Loading
        </Button>
      </div>
    );
  }

  const [selectedReader, setSelectedReader] = useState<User | null>(null);
  const [isEditingReader, setIsEditingReader] = useState(false);


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 shadow-md">
          <CardHeader className="pb-1 px-3 md:px-6 md:pb-2">
            <CardTitle className="text-sm md:text-lg font-medium text-indigo-800">Total Users</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center space-x-2">
              <UserIcon className="h-4 w-4 md:h-5 md:w-5 text-indigo-500" />
              <span className="text-xl md:text-2xl font-bold text-indigo-800">{totalUsers}</span>
            </div>
            <p className="text-xs md:text-sm text-indigo-600 mt-1">
              {totalClients} Clients, {totalReaders} Readers
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 shadow-md">
          <CardHeader className="pb-1 px-3 md:px-6 md:pb-2">
            <CardTitle className="text-sm md:text-lg font-medium text-cyan-800">Total Readings</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-cyan-500" />
              <span className="text-xl md:text-2xl font-bold text-cyan-800">{totalReadings}</span>
            </div>
            <p className="text-xs md:text-sm text-cyan-600 mt-1">
              {completedReadings} Completed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 shadow-md">
          <CardHeader className="pb-1 px-3 md:px-6 md:pb-2">
            <CardTitle className="text-sm md:text-lg font-medium text-emerald-800">Platform Revenue</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="text-xl md:text-2xl font-bold text-emerald-800">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs md:text-sm text-emerald-600 mt-1">
              From {completedReadings} completed readings
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md">
          <CardHeader className="pb-1 px-3 md:px-6 md:pb-2">
            <CardTitle className="text-sm md:text-lg font-medium text-amber-800">Online Readers</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 md:h-5 md:w-5 text-amber-500" />
              <span className="text-xl md:text-2xl font-bold text-amber-800">
                {readers?.filter(reader => reader.isOnline).length || 0}
              </span>
            </div>
            <p className="text-xs md:text-sm text-amber-600 mt-1">
              Of {totalReaders} total readers
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="readings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="readings">All Readings</TabsTrigger>
          <TabsTrigger value="readers">Reader Performance</TabsTrigger>
          <TabsTrigger value="add-readers">Add Readers</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="gifts">Gift Management</TabsTrigger>
        </TabsList>

        <TabsContent value="readings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Readings</CardTitle>
              <CardDescription>
                Complete overview of all readings in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>A list of all readings.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">ID</TableHead>
                      <TableHead className="hidden md:table-cell">Client</TableHead>
                      <TableHead>Reader</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Created</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings && readings.length > 0 ? (
                      readings.map((reading) => (
                        <TableRow key={reading.id}>
                          <TableCell className="font-medium">{reading.id}</TableCell>
                          <TableCell className="hidden md:table-cell">{reading.clientName}</TableCell>
                          <TableCell>{reading.readerName}</TableCell>
                          <TableCell className="hidden sm:table-cell capitalize">{reading.type}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(reading.status)}>
                              {formatStatus(reading.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {reading.createdAt ? new Date(reading.createdAt).toLocaleDateString() : 'Unknown'}
                          </TableCell>
                          <TableCell className="text-right">
                            {reading.totalPrice ? formatCurrency(reading.totalPrice) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No readings found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reader Performance</CardTitle>
              <CardDescription>
                Performance metrics for all psychic readers
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableCaption>Reader performance metrics.</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Rating</TableHead>
                      <TableHead className="hidden sm:table-cell">Sessions</TableHead>
                      <TableHead className="hidden md:table-cell">Specialties</TableHead>
                      <TableHead className="text-right">Earnings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readersWithStats && readersWithStats.length > 0 ? (
                      readersWithStats.map((reader) => (
                        <TableRow key={reader.id}>
                          <TableCell className="font-medium">
                            <Button
                              variant="ghost"
                              className="hover:text-accent"
                              onClick={() => {
                                setSelectedReader(reader);
                                setIsEditingReader(true);
                              }}
                            >
                              {reader.username}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Badge className={reader.isOnline ? "bg-green-500" : "bg-gray-500"}>
                              {reader.isOnline ? "Online" : "Offline"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {reader.rating ? `${reader.rating.toFixed(1)} ⭐` : "No ratings"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">{reader.sessionCount || 0}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {reader.specialties && reader.specialties.length > 0 
                              ? reader.specialties.slice(0, 2).join(", ") + (reader.specialties.length > 2 ? "..." : "")
                              : "None"}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(reader.totalEarnings || 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No readers found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add-readers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Reader</CardTitle>
              <CardDescription>
                Create new psychic reader accounts with specialized profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <AddReaderForm />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shop Products</CardTitle>
              <CardDescription>
                Manage products and sync with Stripe catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {/* Products Data and Management */}
              <ProductsManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gifts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gift Management</CardTitle>
              <CardDescription>
                Process livestream gifts for readers (70% to readers, 30% to platform)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <GiftManagement />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Form for adding new readers
function AddReaderForm() {
  const { toast } = useToast();
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Common reader specialties
  const commonSpecialties = [
    "Tarot Reading", "Astrology", "Medium", "Clairvoyant", "Energy Healing",
    "Palm Reading", "Dream Interpretation", "Numerology", "Past Life Reading",
    "Aura Reading", "Crystal Healing", "Chakra Balancing", "Rune Casting",
    "Spirit Guides", "Angel Reading", "Spiritual Counseling"
  ];

  // Form state
  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
      email: "",
      fullName: "",
      bio: "",
      ratePerMinute: 100, // $1.00 per minute in cents
      phoneReading: true,
      chatReading: true,
      videoReading: true,
    },
  });

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle adding a specialty
  const handleAddSpecialty = () => {
    if (specialty && !specialties.includes(specialty)) {
      setSpecialties([...specialties, specialty]);
      setSpecialty("");
    }
  };

  // Handle selecting a common specialty
  const handleSelectCommonSpecialty = (value: string) => {
    if (!specialties.includes(value)) {
      setSpecialties([...specialties, value]);
    }
  };

  // Handle removing a specialty
  const handleRemoveSpecialty = (index: number) => {
    const updatedSpecialties = [...specialties];
    updatedSpecialties.splice(index, 1);
    setSpecialties(updatedSpecialties);
  };

  // Create reader mutation
  const createReaderMutation = useMutation({
    mutationFn: async (data: FormData) => {
      try {
        const response = await fetch('/api/admin/readers', {
          method: 'POST',
          body: data,
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message || 'Failed to create reader');
        }

        return responseData;
      } catch (error) {
        console.error('Error creating reader:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Reset form
      form.reset();
      setProfileImage(null);
      setProfileImagePreview(null);
      setSpecialties([]);

      // Show success message
      toast({
        title: "Reader Added Successfully",
        description: "The new reader account has been created.",
        variant: "default",
      });

      // Refresh readers list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/readers"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Reader",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Form submission handler
  const onSubmit = async (values: any) => {
    try {
      setIsLoading(true);

      // Create FormData object to handle file upload
      const formData = new FormData();

      // Add all form values to FormData
      Object.keys(values).forEach(key => {
        if (key === 'ratePerMinute') {
          // Convert dollars to cents
          formData.append(key, String(values[key]));
        } else {
          formData.append(key, values[key]);
        }
      });

      // Add role and specialties
      formData.append('role', 'reader');
      formData.append('specialties', JSON.stringify(specialties));

      // Add profile image if exists
      if (profileImage) {
        formData.append('profileImage', profileImage);
      }

      // Call the mutation to create reader
      await createReaderMutation.mutateAsync(formData);
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Basic Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Account Information</h3>
                <p className="text-sm text-muted-foreground">Basic login and contact details for the reader.</p>
              </div>

              <FormField
                control={form.control}
                name="username"
                rules={{ required: "Username is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="reader_username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                rules={{ required: "Password is required", minLength: { value: 8, message: "Password must be at least 8 characters" } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                rules={{ 
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address"
                  }
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="reader@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                rules={{ required: "Full name is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Right Column - Profile Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Profile Information</h3>
                <p className="text-sm text-muted-foreground">Reader's public profile details and specialties.</p>
              </div>

              {/* Profile Image Upload */}
              <div className="space-y-2">
                <Label htmlFor="profile-image">Profile Image</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="h-24 w-24 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-muted overflow-hidden"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profileImagePreview ? (
                      <img 
                        src={profileImagePreview} 
                        alt="Profile Preview" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-10 w-10 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload Image
                    </Button>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      id="profile-image" 
                      accept="image/*" 
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Recommended: Square image, at least 300x300px
                    </p>
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="bio"
                rules={{ required: "Bio is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Write a compelling bio for the reader..."
                        className="min-h-24 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Specialties Selection */}
              <div className="space-y-2">
                <Label>Specialties</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Add a specialty..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={handleAddSpecialty}
                    variant="secondary"
                    size="sm"
                  >
                    Add
                  </Button>
                </div>

                {/* Common specialties */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {commonSpecialties.map((item) => (
                    <Badge
                      key={item}
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/20"
                      onClick={() => handleSelectCommonSpecialty(item)}
                    >
                      + {item}
                    </Badge>
                  ))}
                </div>

                {/* Selected specialties */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {specialties.map((item, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="pl-2 pr-1 py-1"
                    >
                      {item}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-destructive/20 rounded-full"
                        onClick={() => handleRemoveSpecialty(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                {specialties.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Add at least one specialty for the reader.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Rate and Reading Type Settings */}
          <div className="border rounded-lg p-4 space-y-4 bg-secondary/5">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Reading Settings</h3>
              <p className="text-sm text-muted-foreground">Configure the reader's rates and available reading types.</p>
            </div>

            <FormField
              control={form.control}
              name="ratePerMinute"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Per Minute (in cents)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2">$</span>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="100"
                        className="pl-7"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    The amount charged per minute of reading (in cents). Example: 100 = $1.00/min
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="chatReading"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Chat Reading</FormLabel>
                      <FormDescription>
                        Offer text-based chat readings
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phoneReading"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Phone Reading</FormLabel>
                      <FormDescription>
                        Offer voice call readings
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="videoReading"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Video Reading</FormLabel>
                      <FormDescription>
                        Offer video call readings
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit"
            className="w-full md:w-auto"
            disabled={isLoading || createReaderMutation.isPending || specialties.length === 0}
          >
            {(isLoading || createReaderMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Add Reader
          </Button>
        </form>
      </Form>
    </div>
  );
}

// Create a separate component for Products Management to keep the main component clean
function ProductsManagement() {
  const { toast } = useToast();

  // Fetch all products
  const {
    data: products,
    error: productsError,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["/api/products"],
  });

  // Mutation for syncing products with Stripe
  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/products/sync-with-stripe");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to sync products with Stripe");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Products Synced",
        description: `Successfully synced ${data.successCount} of ${data.totalProducts} products with Stripe catalog`,
        variant: "default",
      });
      // Refresh the products list after syncing
      refetchProducts();
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for importing products from Stripe
  const importProductsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/products/import-from-stripe");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to import products from Stripe");
      }
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Products Imported",
        description: `Successfully imported ${data.successCount} new products from Stripe catalog`,
        variant: "default",
      });
      // Refresh the products list after importing
      refetchProducts();
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (productsLoading) {
    return (
      <div className="flex items-center justify-center min-h-48">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="text-center p-6 text-red-800">
        <p>Error loading products. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-4 sm:px-0">
        <div className="text-sm text-muted-foreground">
          {Array.isArray(products) ? products.length : 0} {Array.isArray(products) && products.length === 1 ? 'product' : 'products'} in catalog
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => importProductsMutation.mutate()}
            disabled={importProductsMutation.isPending || syncProductsMutation.isPending}
            variant="outline"
            className="flex items-center gap-2"
          >
            {importProductsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Package className="h-4 w-4" />
            Import from Stripe
          </Button>
          <Button 
            onClick={() => syncProductsMutation.mutate()}
            disabled={syncProductsMutation.isPending || importProductsMutation.isPending}
            className="flex items-center gap-2"
          >
            {syncProductsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <RefreshCw className="h-4 w-4" />
            Sync with Stripe
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableCaption>Shop products inventory</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Featured</TableHead>
              <TableHead className="hidden md:table-cell">Stripe ID</TableHead>
              <TableHead className="text-right">Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products && Array.isArray(products) && products.length > 0 ? (
              products.map((product: any) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.id}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="hidden md:table-cell max-w-[250px] truncate">
                    {product.description}
                  </TableCell>
                  <TableCell className="capitalize">{product.category}</TableCell>
                  <TableCell className="text-center">{product.stock}</TableCell>
                  <TableCell className="text-center">
                    {product.featured ? "✓" : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {product.stripeProductId ? (
                      <span className="text-xs text-green-600 whitespace-nowrap truncate max-w-[150px] inline-block">
                        {product.stripeProductId.substring(0, 14)}...
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">Not synced</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(product.price)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}